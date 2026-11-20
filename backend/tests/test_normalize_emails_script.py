"""The one-off email migration decides safely before it writes anything."""

from scripts.normalize_emails import mask, normalize, plan_user_changes


def test_mixed_case_accounts_are_lower_cased():
    plan = plan_user_changes(
        [{"_id": 1, "email": "Ada@Example.com"}, {"_id": 2, "email": "bob@x.com"}]
    )
    assert plan.updates == [(1, "Ada@Example.com", "ada@example.com")]
    assert plan.conflicts == {}


def test_accounts_differing_only_by_case_are_reported_not_merged():
    plan = plan_user_changes([{"_id": 1, "email": "Ada@x.com"}, {"_id": 2, "email": "ada@x.com"}])
    assert plan.updates == []
    assert plan.conflicts == {"ada@x.com": ["Ada@x.com", "ada@x.com"]}


def test_whitespace_is_trimmed():
    assert normalize("  Ada@X.com ") == "ada@x.com"


def test_masked_output_hides_most_of_the_address():
    assert mask("adalovelace@example.com") == "ad***@example.com"
