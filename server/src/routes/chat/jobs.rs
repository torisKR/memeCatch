//! The process-wide state of `answerMemeQuestion`: `answers`, the cache of
//! generated answers (32, a minute each, oldest out first), and `jobs`, one
//! provider request shared by the callers that ask the same question about
//! the same records. A caller that goes away stops waiting; when the last
//! one goes, the request is cancelled (`waitForJob`).

use std::collections::HashMap;
use std::future::Future;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tokio::sync::{Notify, watch};

use super::generate::Generated;

const MAX_CACHE: usize = 32;
const CACHE_TTL: Duration = Duration::from_secs(60);

pub struct Job {
    result: watch::Receiver<Option<Option<Generated>>>,
    waiters: Mutex<usize>,
    aborted: AtomicBool,
    cancel: Notify,
}

impl Job {
    fn abort(&self) {
        self.aborted.store(true, Ordering::SeqCst);
        self.cancel.notify_one();
    }

    fn is_aborted(&self) -> bool {
        self.aborted.load(Ordering::SeqCst)
    }
}

#[derive(Default)]
pub struct Jobs {
    answers: Mutex<Vec<(String, Instant, Generated)>>,
    jobs: Mutex<HashMap<String, Arc<Job>>>,
}

/// What the cache and the running jobs give for a key.
pub enum Lookup {
    /// `answers.get(key)`, not expired: moved to the newest place.
    Cached(Generated),
    /// A job to wait for: running already, or started for this caller.
    Job(Arc<Job>),
    /// Neither, and 32 jobs are running: answer without generating.
    Full,
}

impl Jobs {
    /// The cached answer, the running job, or a new job running `generate`,
    /// decided at once (both locks held), as the single-threaded TypeScript
    /// decides it: two callers of one key never start two requests.
    pub fn join<F>(self: &Arc<Self>, key: &str, generate: impl FnOnce() -> F) -> Lookup
    where
        F: Future<Output = Option<Generated>> + Send + 'static,
    {
        let mut answers = self.answers.lock().expect("answers lock");
        if let Some(at) = answers.iter().position(|(known, _, _)| known == key) {
            let entry = answers.remove(at);
            if entry.1 > Instant::now() {
                let value = entry.2.clone();
                answers.push(entry);
                return Lookup::Cached(value);
            }
        }
        let mut jobs = self.jobs.lock().expect("jobs lock");
        match jobs.get(key) {
            Some(job) if !job.is_aborted() => Lookup::Job(job.clone()),
            _ if jobs.len() >= MAX_CACHE => Lookup::Full,
            _ => {
                let job = self.spawn(key.to_owned(), generate());
                jobs.insert(key.to_owned(), job.clone());
                Lookup::Job(job)
            }
        }
    }

    /// Runs `generate` as the job of `key`. The answer, if any and not
    /// cancelled, is cached; the job leaves the map when it ends.
    fn spawn<F>(self: &Arc<Self>, key: String, generate: F) -> Arc<Job>
    where
        F: Future<Output = Option<Generated>> + Send + 'static,
    {
        let (sender, result) = watch::channel(None);
        let job = Arc::new(Job {
            result,
            waiters: Mutex::new(0),
            aborted: AtomicBool::new(false),
            cancel: Notify::new(),
        });
        let (jobs, running) = (self.clone(), job.clone());
        tokio::spawn(async move {
            let value = tokio::select! {
                value = generate => value,
                () = running.cancel.notified() => None,
            };
            if let Some(value) = value.as_ref().filter(|_| !running.is_aborted()) {
                jobs.remember(&key, value.clone());
            }
            let mut map = jobs.jobs.lock().expect("jobs lock");
            if map
                .get(&key)
                .is_some_and(|known| Arc::ptr_eq(known, &running))
            {
                map.remove(&key);
            }
            drop(map);
            let _ = sender.send(Some(value));
        });
        job
    }

    fn remember(&self, key: &str, value: Generated) {
        let mut answers = self.answers.lock().expect("answers lock");
        answers.retain(|(known, _, _)| known != key);
        answers.push((key.to_owned(), Instant::now() + CACHE_TTL, value));
        while answers.len() > MAX_CACHE {
            answers.remove(0);
        }
    }
}

/// One caller waiting for a job. Dropped before the answer (the caller went
/// away), it counts as cancelled.
struct Waiter {
    job: Arc<Job>,
    finished: bool,
}

impl Drop for Waiter {
    fn drop(&mut self) {
        let mut waiters = self.job.waiters.lock().expect("waiters lock");
        *waiters -= 1;
        if *waiters == 0 && !self.finished {
            self.job.abort();
        }
    }
}

/// `waitForJob(job, signal)`: the job's answer. Cancel it by dropping it.
pub async fn wait(job: Arc<Job>) -> Option<Generated> {
    *job.waiters.lock().expect("waiters lock") += 1;
    let mut waiter = Waiter {
        job: job.clone(),
        finished: false,
    };
    let mut result = job.result.clone();
    let value = match result.wait_for(Option::is_some).await {
        Ok(value) => value.clone().flatten(),
        Err(_) => None,
    };
    waiter.finished = true;
    value
}

#[cfg(test)]
mod tests {
    use super::*;

    fn answer(text: &str) -> Generated {
        Generated {
            answer: text.to_owned(),
            citation_ids: Vec::new(),
        }
    }

    #[tokio::test]
    async fn one_request_serves_every_caller_and_the_answer_is_cached() {
        let jobs = Arc::new(Jobs::default());
        let Lookup::Job(job) = jobs.join("k", || async { Some(answer("a")) }) else {
            panic!("a job starts");
        };
        let Lookup::Job(same) = jobs.join("k", || async { None }) else {
            panic!("the job is running");
        };
        assert!(Arc::ptr_eq(&job, &same));
        let (first, second) = tokio::join!(wait(job), wait(same));
        assert_eq!(first, Some(answer("a")));
        assert_eq!(second, Some(answer("a")));
        assert!(
            matches!(jobs.join("k", || async { None }), Lookup::Cached(value) if value == answer("a"))
        );
    }

    #[tokio::test]
    async fn the_last_caller_leaving_cancels_the_request() {
        let jobs = Arc::new(Jobs::default());
        let (dropped_tx, dropped_rx) = tokio::sync::oneshot::channel::<()>();
        let Lookup::Job(job) = jobs.join("k", || async move {
            let _guard = DropSignal(Some(dropped_tx));
            std::future::pending::<Option<Generated>>().await
        }) else {
            panic!("a job starts");
        };
        let waiting = tokio::spawn(wait(job.clone()));
        tokio::task::yield_now().await;
        waiting.abort();
        let _ = waiting.await;
        tokio::time::timeout(Duration::from_secs(1), dropped_rx)
            .await
            .expect("the request future was dropped")
            .ok();
        assert!(job.is_aborted());
        let Lookup::Job(next) = jobs.join("k", || async { None }) else {
            panic!("a new job starts");
        };
        assert!(!Arc::ptr_eq(&job, &next));
    }

    struct DropSignal(Option<tokio::sync::oneshot::Sender<()>>);

    impl Drop for DropSignal {
        fn drop(&mut self) {
            if let Some(sender) = self.0.take() {
                let _ = sender.send(());
            }
        }
    }

    #[tokio::test]
    async fn at_most_32_answers_are_kept_oldest_out_first() {
        let jobs = Arc::new(Jobs::default());
        for index in 0..33 {
            jobs.remember(&index.to_string(), answer("a"));
        }
        assert!(matches!(
            jobs.join("1", || async { None }),
            Lookup::Cached(_)
        ));
        assert!(matches!(jobs.join("0", || async { None }), Lookup::Job(_)));
    }
}
