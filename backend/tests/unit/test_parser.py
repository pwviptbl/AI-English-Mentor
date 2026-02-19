import pytest
from app.services.llm_types import extract_json_object, JSON_PATTERN
import json

def test_extract_json_object_from_plain_json():
    text = '{"key": "value"}'
    result = extract_json_object(text)
    assert result == {"key": "value"}

def test_extract_json_object_from_wrapped_text():
    text = 'Here is the JSON:\n{"key": "value"}\nHope this helps.'
    result = extract_json_object(text)
    assert result == {"key": "value"}

def test_extract_json_object_from_markdown_block():
    text = """
Here is the analysis:
```json
{
  "original_en": "Hello",
  "translation_pt": "Olá",
  "tokens": []
}
```
End of analysis.
"""
    result = extract_json_object(text)
    assert result["original_en"] == "Hello"
    assert result["translation_pt"] == "Olá"

def test_extract_json_object_from_markdown_no_lang():
    text = """
```
{"foo": "bar"}
```
"""
    result = extract_json_object(text)
    assert result == {"foo": "bar"}

def test_extract_json_object_invalid_raises():
    text = "Not a json"
    with pytest.raises(json.JSONDecodeError):
        extract_json_object(text)
