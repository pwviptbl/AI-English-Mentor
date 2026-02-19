from app.services.llm_types import extract_json_object


def test_extract_json_object_from_plain_json() -> None:
    payload = extract_json_object('{"a": 1, "b": "ok"}')
    assert payload["a"] == 1
    assert payload["b"] == "ok"


def test_extract_json_object_from_wrapped_text() -> None:
    text = "Result:\n```json\n{\"corrected_text\": \"Hello\", \"changed\": true}\n```"
    payload = extract_json_object(text)
    assert payload["corrected_text"] == "Hello"
    assert payload["changed"] is True
