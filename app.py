"""Compatibility entry point: launch the NEW FastAPI service, not the legacy app."""
import uvicorn
if __name__ == '__main__':
    uvicorn.run('ai_service.main:app', host='127.0.0.1', port=8000)
