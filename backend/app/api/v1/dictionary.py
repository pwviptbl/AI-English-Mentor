from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.db.models import User
from app.schemas.analysis import TokenInfo
from app.services.dictionary_lookup import DictionaryLookupService

router = APIRouter(prefix="/dictionary", tags=["dictionary"])

dictionary_lookup_service = DictionaryLookupService()


@router.get("/lookup", response_model=TokenInfo)
async def lookup_word(
    word: str = Query(..., min_length=1, max_length=80),
    _current_user: User = Depends(get_current_user),
) -> TokenInfo:
    return await dictionary_lookup_service.lookup(word)
