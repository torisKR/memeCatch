use std::net::{Ipv4Addr, SocketAddr};

use memecatch_server::config::Config;
use memecatch_server::{AppState, build_app};
use tokio::net::TcpListener;
use tokio::signal::unix::{SignalKind, signal};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt().with_ansi(false).init();
    // `memecatch-server embedder` runs the embedding model instead
    // (src/embedder/service.rs): another container, another process.
    let result = if std::env::args().nth(1).as_deref() == Some("embedder") {
        memecatch_server::embedder::service::serve(shutdown_signal()).await
    } else {
        run().await
    };
    if let Err(message) = result {
        tracing::error!("{message}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    let config = Config::from_env().map_err(|error| error.to_string())?;
    let port = config.port;
    tracing::info!(
        port,
        upstream = %config.upstream,
        db_pool_max = config.db_pool_max,
        disabled_routes = ?config.disabled_routes,
        "starting memecatch-server"
    );
    let app = build_app(AppState::new(config)?);
    let listener = TcpListener::bind((Ipv4Addr::UNSPECIFIED, port))
        .await
        .map_err(|error| format!("cannot listen on port {port}: {error}"))?;
    // The peer address is the rate limit key of a request that carries no
    // X-Forwarded-For (routes/public/rate_limit.rs).
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await
    .map_err(|error| format!("server stopped: {error}"))
}

// As PID 1 in a container the process gets no default SIGTERM action, so
// `docker stop` would wait out its grace period without this.
async fn shutdown_signal() {
    let mut terminate = signal(SignalKind::terminate()).expect("SIGTERM handler");
    let mut interrupt = signal(SignalKind::interrupt()).expect("SIGINT handler");
    tokio::select! {
        _ = terminate.recv() => {}
        _ = interrupt.recv() => {}
    }
}
