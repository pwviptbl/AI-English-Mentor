def _auth_headers(client, email: str = "user@example.com", password: str = "secret1234") -> dict:
    register_response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Test User", "email": email, "password": password},
    )
    assert register_response.status_code == 200
    assert register_response.json()["full_name"] == "Test User"

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_end_to_end_chat_analysis_and_srs(client) -> None:
    headers = _auth_headers(client)

    session_response = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"topic": "Travel", "persona_prompt": "You are a travel buddy."},
    )
    assert session_response.status_code == 200
    session_id = session_response.json()["id"]

    chat_response = client.post(
        "/api/v1/chat/send",
        headers=headers,
        json={"session_id": session_id, "text_raw": "Eu acho que we need to go agora"},
    )
    assert chat_response.status_code == 200
    chat_payload = chat_response.json()
    assert chat_payload["corrected_text"] == "I think we need to go now"
    assert chat_payload["assistant_reply"].startswith("Great point")

    messages_response = client.get(f"/api/v1/sessions/{session_id}/messages", headers=headers)
    assert messages_response.status_code == 200
    messages = messages_response.json()
    assert len(messages) == 2

    assistant_message_id = chat_payload["assistant_message_id"]
    analysis_response = client.post(
        f"/api/v1/messages/{assistant_message_id}/analysis",
        headers=headers,
    )
    assert analysis_response.status_code == 200
    analysis_payload = analysis_response.json()
    assert analysis_payload["tokens"]

    user_message_id = chat_payload["user_message_id"]
    user_analysis_response = client.post(
        f"/api/v1/messages/{user_message_id}/analysis",
        headers=headers,
    )
    assert user_analysis_response.status_code == 200
    user_analysis_payload = user_analysis_response.json()
    assert user_analysis_payload["tokens"]

    add_flashcard_response = client.post(
        "/api/v1/flashcards",
        headers=headers,
        json={
            "word": analysis_payload["tokens"][0]["token"],
            "lemma": analysis_payload["tokens"][0]["lemma"],
            "pos": analysis_payload["tokens"][0]["pos"],
            "translation": analysis_payload["tokens"][0]["translation"],
            "definition": analysis_payload["tokens"][0]["definition"],
            "context_sentence": analysis_payload["original_en"],
        },
    )
    assert add_flashcard_response.status_code == 200
    flashcard_id = add_flashcard_response.json()["id"]

    duplicate_flashcard_response = client.post(
        "/api/v1/flashcards",
        headers=headers,
        json={
            "word": analysis_payload["tokens"][0]["token"],
            "lemma": analysis_payload["tokens"][0]["lemma"],
            "pos": analysis_payload["tokens"][0]["pos"],
            "translation": analysis_payload["tokens"][0]["translation"],
            "definition": analysis_payload["tokens"][0]["definition"],
            "context_sentence": analysis_payload["original_en"],
        },
    )
    assert duplicate_flashcard_response.status_code == 409

    due_response = client.get("/api/v1/flashcards/due", headers=headers)
    assert due_response.status_code == 200
    assert len(due_response.json()) == 1

    review_response = client.post(
        "/api/v1/reviews",
        headers=headers,
        json={"flashcard_id": flashcard_id, "rating": "good"},
    )
    assert review_response.status_code == 200
    assert review_response.json()["repetitions"] >= 1

    stats_response = client.get("/api/v1/reviews/stats", headers=headers)
    assert stats_response.status_code == 200
    stats = stats_response.json()
    assert stats["total_cards"] == 1
    assert stats["reviews_today"] == 1
