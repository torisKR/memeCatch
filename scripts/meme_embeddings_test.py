import argparse
import json
import math
import unittest
from unittest.mock import patch
import meme_embeddings as embeddings


class EmbeddingContractTests(unittest.TestCase):
    def test_fixed_normalized_dimension(self):
        valid = [1.0] + [0.0] * 383
        self.assertTrue(embeddings.validate_vector(valid))
        for invalid in [valid[:-1], [0.0] * 384, [2.0] + [0.0] * 383,
                        [float('nan')] + valid[1:], [float('inf')] + valid[1:],
                        [True] + valid[1:]]:
            self.assertFalse(embeddings.validate_vector(invalid))
        self.assertTrue(embeddings.validate_vector([1 / math.sqrt(384)] * 384))

    def test_prefix_and_batch_limits(self):
        self.assertEqual(embeddings.validate_inputs('query: 한국어 상황'), ['query: 한국어 상황'])
        self.assertEqual(embeddings.validate_inputs(['passage: 한국어 설명']), ['passage: 한국어 설명'])
        for invalid in ['', '한국어', 'query:   ', [], ['query: a'] * 5, ['passage: ' + 'a' * 7000], None, [1]]:
            with self.assertRaises(ValueError):
                embeddings.validate_inputs(invalid)

    def test_remote_index_requires_explicit_flag_before_access(self):
        args = argparse.Namespace(local=False, allow_remote=False, limit=25)
        with patch.dict('os.environ', {'NEXT_PUBLIC_SUPABASE_URL': 'https://example.supabase.co', 'SUPABASE_SERVICE_ROLE_KEY': 'existing-key'}), patch.object(embeddings, 'rpc') as rpc:
            with self.assertRaisesRegex(ValueError, 'remote_indexing_requires_allow_remote'):
                embeddings.index_catalog(args)
            rpc.assert_not_called()

    def test_no_jobs_does_not_load_model(self):
        args = argparse.Namespace(local=True, allow_remote=False, limit=25)
        with patch.object(embeddings, 'local_connection', return_value=('http://127.0.0.1:54321', 'existing-key')), patch.object(embeddings, 'rpc', return_value=[]) as rpc, patch.object(embeddings, 'Encoder') as model, patch('builtins.print'):
            embeddings.index_catalog(args)
            model.assert_not_called()
            rpc.assert_called_once_with('http://127.0.0.1:54321', 'existing-key', 'list_meme_embedding_jobs', {'p_limit': 25})

    def test_stale_job_is_counted_and_never_retried_with_new_hash(self):
        args = argparse.Namespace(local=True, allow_remote=False, limit=25)
        job = {'meme_id': 'qa', 'document': '한국어 설명', 'source_hash': 'original-hash'}
        with patch.object(embeddings, 'local_connection', return_value=('http://127.0.0.1:54321', 'existing-key')), patch.object(embeddings, 'rpc', side_effect=[[job], False]) as rpc, patch.object(embeddings, 'Encoder') as model, patch('builtins.print') as output:
            model.return_value.encode.return_value = [[1.0] + [0.0] * 383]
            embeddings.index_catalog(args)
            self.assertEqual(rpc.call_count, 2)
            self.assertEqual(rpc.call_args.args[3]['p_source_hash'], 'original-hash')
            self.assertIn('"stale": 1', output.call_args.args[0])

    def test_two_batches_initialize_encoder_once_and_encode_four_at_a_time(self):
        args = argparse.Namespace(local=True, allow_remote=False, limit=5, batches=2)
        jobs = [{'meme_id': f'00000000-0000-0000-0000-{number:012d}',
                 'document': f'private test document {number}', 'source_hash': f'hash-{number}'}
                for number in range(1, 10)]
        fetched = []
        stored = []

        def fake_rpc(_url, _key, name, body):
            if name == 'list_meme_embedding_jobs':
                fetched.append(body)
                return jobs[:5] if len(fetched) == 1 else jobs[5:]
            stored.append(body)
            return True

        with patch.object(embeddings, 'local_connection', return_value=('http://127.0.0.1:54321', 'existing-key')), patch.object(embeddings, 'rpc', side_effect=fake_rpc), patch.object(embeddings, 'Encoder') as model, patch('builtins.print') as output:
            model.return_value.encode.side_effect = lambda inputs: [[1.0] + [0.0] * 383 for _ in inputs]
            embeddings.index_catalog(args)
            model.assert_called_once_with()
            self.assertEqual([len(call.args[0]) for call in model.return_value.encode.call_args_list], [4, 1, 4])
            self.assertEqual(fetched, [{'p_limit': 5}, {'p_limit': 5, 'p_after': jobs[4]['meme_id']}])
            self.assertEqual([body['p_meme_id'] for body in stored], [job['meme_id'] for job in jobs])
            progress = [json.loads(call.args[0]) for call in output.call_args_list]
            self.assertEqual([row['batch_indexed'] for row in progress], [5, 4])
            self.assertEqual([row['indexed'] for row in progress], [5, 9])
            self.assertEqual([row['batch'] for row in progress], [1, 2])
            for call in output.call_args_list:
                self.assertNotIn('private test document', call.args[0])
                self.assertNotIn(jobs[0]['meme_id'], call.args[0])
                self.assertNotIn('existing-key', call.args[0])

    def test_empty_initial_batch_stops_before_loading_model_or_fetching_again(self):
        args = argparse.Namespace(local=True, allow_remote=False, limit=100, batches=100)
        with patch.object(embeddings, 'local_connection', return_value=('http://127.0.0.1:54321', 'existing-key')), patch.object(embeddings, 'rpc', return_value=[]) as rpc, patch.object(embeddings, 'Encoder') as model, patch('builtins.print') as output:
            embeddings.index_catalog(args)
            rpc.assert_called_once()
            model.assert_not_called()
            self.assertEqual(json.loads(output.call_args.args[0])['indexed'], 0)

    def test_exact_batch_budget_bounds_calls_and_advances_past_stale_rows(self):
        args = argparse.Namespace(local=True, allow_remote=False, limit=1, batches=3)
        jobs = [{'meme_id': str(number), 'document': '설명', 'source_hash': 'original'} for number in range(1, 4)]
        responses = [[jobs[0]], False, [jobs[1]], True, [jobs[2]], True]
        with patch.object(embeddings, 'local_connection', return_value=('http://127.0.0.1:54321', 'existing-key')), patch.object(embeddings, 'rpc', side_effect=responses) as rpc, patch.object(embeddings, 'Encoder') as model, patch('builtins.print') as output:
            model.return_value.encode.return_value = [[1.0] + [0.0] * 383]
            embeddings.index_catalog(args)
            self.assertEqual(rpc.call_count, 6)
            self.assertEqual([call.args[3] for call in rpc.call_args_list[::2]],
                             [{'p_limit': 1}, {'p_limit': 1, 'p_after': '1'}, {'p_limit': 1, 'p_after': '2'}])
            self.assertEqual([call.args[3]['p_source_hash'] for call in rpc.call_args_list[1::2]], ['original'] * 3)
            self.assertEqual(json.loads(output.call_args.args[0])['stale'], 1)
            self.assertEqual(json.loads(output.call_args.args[0])['indexed'], 2)
            self.assertEqual(len(output.call_args_list), 3)

    def test_save_failure_aborts_without_retrying_or_reading_further_batches(self):
        args = argparse.Namespace(local=True, allow_remote=False, limit=1, batches=100)
        job = {'meme_id': '1', 'document': '설명', 'source_hash': 'original'}
        with patch.object(embeddings, 'local_connection', return_value=('http://127.0.0.1:54321', 'existing-key')), patch.object(embeddings, 'rpc', side_effect=[[job], True, [dict(job, meme_id='2')], RuntimeError('storage_failure')]) as rpc, patch.object(embeddings, 'Encoder') as model, patch('builtins.print') as output:
            model.return_value.encode.return_value = [[1.0] + [0.0] * 383]
            with self.assertRaisesRegex(RuntimeError, 'storage_failure'):
                embeddings.index_catalog(args)
            self.assertEqual(rpc.call_count, 4)
            model.assert_called_once()
            self.assertEqual(len(output.call_args_list), 1)
            self.assertEqual(json.loads(output.call_args.args[0])['indexed'], 1)

    def test_invalid_bounds_are_rejected_before_connection_or_model_loading(self):
        for limit, batches in [(0, 1), (101, 1), (1, 0), (1, 101), (100, 101), (True, 1), (1, True), (1, 1.5)]:
            with self.subTest(limit=limit, batches=batches):
                args = argparse.Namespace(local=True, allow_remote=False, limit=limit, batches=batches)
                with patch.object(embeddings, 'local_connection') as connection, patch.object(embeddings, 'rpc') as rpc, patch.object(embeddings, 'Encoder') as model:
                    with self.assertRaises(ValueError):
                        embeddings.index_catalog(args)
                    connection.assert_not_called()
                    rpc.assert_not_called()
                    model.assert_not_called()

    def test_server_cannot_exceed_requested_row_limit(self):
        args = argparse.Namespace(local=True, allow_remote=False, limit=1, batches=100)
        job = {'meme_id': '1', 'document': '설명', 'source_hash': 'original'}
        with patch.object(embeddings, 'local_connection', return_value=('http://127.0.0.1:54321', 'existing-key')), patch.object(embeddings, 'rpc', return_value=[job, job]) as rpc, patch.object(embeddings, 'Encoder') as model:
            with self.assertRaisesRegex(ValueError, 'invalid_embedding_jobs_response'):
                embeddings.index_catalog(args)
            rpc.assert_called_once()
            model.assert_not_called()

    def test_incomplete_encoder_batch_and_non_boolean_store_responses_abort(self):
        args = argparse.Namespace(local=True, allow_remote=False, limit=1, batches=2)
        job = {'meme_id': '1', 'document': '설명', 'source_hash': 'original'}
        with patch.object(embeddings, 'local_connection', return_value=('http://127.0.0.1:54321', 'existing-key')), patch.object(embeddings, 'rpc', return_value=[job]) as rpc, patch.object(embeddings, 'Encoder') as model:
            model.return_value.encode.return_value = []
            with self.assertRaisesRegex(ValueError, 'invalid_model_output'):
                embeddings.index_catalog(args)
            rpc.assert_called_once()
        with patch.object(embeddings, 'local_connection', return_value=('http://127.0.0.1:54321', 'existing-key')), patch.object(embeddings, 'rpc', side_effect=[[job], 1]) as rpc, patch.object(embeddings, 'Encoder') as model:
            model.return_value.encode.return_value = [[1.0] + [0.0] * 383]
            with self.assertRaisesRegex(ValueError, 'invalid_embedding_store_response'):
                embeddings.index_catalog(args)
            self.assertEqual(rpc.call_count, 2)


if __name__ == '__main__':
    unittest.main()
