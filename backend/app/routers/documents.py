from fastapi import APIRouter, Depends
from supabase import Client

from app.core.deps import get_current_user, get_scoped_client, CurrentUser
from app.schemas.misc import DocumentOut
from pydantic import BaseModel
from app.services.audit import log_action

router = APIRouter(prefix="/documents", tags=["documents"])


class DocumentMetadataIn(BaseModel):
    document_type: str
    file_name: str
    storage_path: str
    file_size_bytes: int | None = None
    mime_type: str | None = None


@router.get("", response_model=list[DocumentOut])
def list_documents(user: CurrentUser = Depends(get_current_user),
                    client: Client = Depends(get_scoped_client)):
    resp = client.table("uploaded_documents").select("*").eq("user_id", user.id).execute()
    return resp.data or []


@router.post("", response_model=DocumentOut)
def register_document(payload: DocumentMetadataIn,
                       user: CurrentUser = Depends(get_current_user),
                       client: Client = Depends(get_scoped_client)):
    """
    Frontend uploads the file directly to Supabase Storage (client SDK),
    then calls this endpoint to register the metadata row.
    Phase 1: no parsing/analysis — just encrypted storage + metadata.
    """
    data = {**payload.model_dump(), "user_id": user.id}
    resp = client.table("uploaded_documents").insert(data).execute()
    log_action(user.id, "document_uploaded", "document", resp.data[0]["id"],
               {"document_type": payload.document_type})
    return resp.data[0]
