/**
 * Per-test failure detail for the Tests panel's expandable assertion view
 * (design_handoff/README.md "Tests panel"). `tests.result` only carries aggregate
 * totals (types.ts `TestsResultEvent`) — a real backend would need to enrich this per
 * test; this is that enrichment's mock counterpart, keyed to MOCK_PARTIAL_TAIL.
 */

export interface MockTestFailure {
  name: string;
  location: string;
  detail: string;
}

export const MOCK_TEST_FAILURES: MockTestFailure[] = [
  {
    name: "test_update_book",
    location: "test_main.py:37",
    detail: '>   assert r.json()["year"] == 1966\nE   assert 1965 == 1966',
  },
  {
    name: "test_list_books",
    location: "test_main.py:28",
    detail: ">   assert len(r.json()) >= 1\nE   assert 0 >= 1",
  },
];
