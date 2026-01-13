"""
PDF Image Extraction Service
Extracts pages from PDF files as PNG images using PyMuPDF
"""

import uuid
from typing import Optional

import fitz  # PyMuPDF
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PDF Image Extractor", version="1.0.0")

# Allow CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
CONFIG = {
    "scale": 2.0,      # Render scale for quality (2x = 144 DPI)
    "max_width": 1200, # Max image width in pixels
}

# In-memory storage for extracted images (session_id -> {image_id -> bytes})
image_store: dict[str, dict[str, bytes]] = {}


class ExtractedImage(BaseModel):
    id: str
    page_number: int
    label: str
    width: int
    height: int


class ExtractionResponse(BaseModel):
    success: bool
    session_id: str
    total_pages: int
    extracted_pages: int
    images: list[ExtractedImage]


class HealthResponse(BaseModel):
    status: str
    version: str


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "version": "1.0.0"}


@app.post("/extract", response_model=ExtractionResponse)
async def extract_pdf_pages(
    file: UploadFile = File(...),
    session_id: str = "",
    max_pages: Optional[int] = None,
):
    """
    Extract all pages from a PDF as PNG images.
    Returns metadata about extracted images.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF")

    # Generate session ID if not provided
    if not session_id:
        session_id = str(uuid.uuid4())[:8]

    try:
        # Read PDF content
        pdf_bytes = await file.read()

        # Open PDF with PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        total_pages = len(doc)

        # Determine pages to extract
        pages_to_extract = min(max_pages, total_pages) if max_pages else total_pages

        # Initialize session storage
        if session_id not in image_store:
            image_store[session_id] = {}

        extracted_images: list[ExtractedImage] = []

        for page_num in range(pages_to_extract):
            page = doc[page_num]

            # Render page to image
            mat = fitz.Matrix(CONFIG["scale"], CONFIG["scale"])
            pix = page.get_pixmap(matrix=mat, alpha=False)

            # Scale down if too wide
            if pix.width > CONFIG["max_width"]:
                scale_factor = CONFIG["max_width"] / pix.width
                mat = fitz.Matrix(CONFIG["scale"] * scale_factor, CONFIG["scale"] * scale_factor)
                pix = page.get_pixmap(matrix=mat, alpha=False)

            # Convert to PNG bytes
            png_bytes = pix.tobytes("png")

            # Store image
            image_id = f"page-{page_num + 1}"
            image_store[session_id][image_id] = png_bytes

            extracted_images.append(ExtractedImage(
                id=image_id,
                page_number=page_num + 1,
                label=f"Sida {page_num + 1}",
                width=pix.width,
                height=pix.height,
            ))

        doc.close()

        return ExtractionResponse(
            success=True,
            session_id=session_id,
            total_pages=total_pages,
            extracted_pages=len(extracted_images),
            images=extracted_images,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract PDF: {str(e)}")


@app.get("/images/{session_id}/{image_id}")
async def get_image(session_id: str, image_id: str):
    """
    Get an extracted image by session and image ID.
    Returns PNG image.
    """
    if session_id not in image_store:
        raise HTTPException(status_code=404, detail="Session not found")

    if image_id not in image_store[session_id]:
        raise HTTPException(status_code=404, detail="Image not found")

    png_bytes = image_store[session_id][image_id]

    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={
            "Cache-Control": "public, max-age=3600",
        }
    )


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete all images for a session"""
    if session_id in image_store:
        del image_store[session_id]
        return {"success": True, "message": f"Session {session_id} deleted"}

    raise HTTPException(status_code=404, detail="Session not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
