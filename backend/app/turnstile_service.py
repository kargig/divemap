import httpx
import os
import time
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from .monitoring.turnstile_monitor import record_verification_event

class TurnstileService:
    def __init__(self):
        self.secret_key = os.getenv("TURNSTILE_SECRET_KEY")
        self.site_key = os.getenv("TURNSTILE_SITE_KEY")
        self.verify_url = os.getenv("TURNSTILE_VERIFY_URL", "https://challenges.cloudflare.com/turnstile/v0/siteverify")
        self._initialized = False
    
    def is_enabled(self):
        """Check if Turnstile is properly configured and enabled"""
        return bool(
            self.secret_key and 
            self.site_key and 
            self.secret_key.strip() and 
            self.site_key.strip() and
            self.secret_key != 'undefined' and
            self.site_key != 'undefined'
        )
    
    def _ensure_initialized(self):
        """Ensure the service is properly initialized with environment variables"""
        if not self._initialized:
            if not self.is_enabled():
                raise ValueError("Both TURNSTILE_SECRET_KEY and TURNSTILE_SITE_KEY environment variables must be set and non-empty")
            self._initialized = True
    
    async def verify_token(self, token: str, remote_ip: str) -> Dict[str, Any]:
        """Verify Turnstile token with Cloudflare"""
        self._ensure_initialized()
        start_time = time.time()
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.verify_url,
                    data={
                        "secret": self.secret_key,
                        "response": token,
                        "remoteip": remote_ip
                    },
                    timeout=10.0
                )
                
                if response.status_code != 200:
                    response_time = (time.time() - start_time) * 1000
                    record_verification_event(
                        success=False,
                        response_time_ms=response_time,
                        error_code="http_error",
                        client_ip=remote_ip
                    )
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to verify Turnstile token"
                    )
                
                result = await response.json()
                response_time = (time.time() - start_time) * 1000
                
                if not result.get("success"):
                    error_codes = result.get("error-codes", [])
                    record_verification_event(
                        success=False,
                        response_time_ms=response_time,
                        error_code=",".join(error_codes) if error_codes else "unknown",
                        client_ip=remote_ip
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Turnstile verification failed: {', '.join(error_codes)}"
                    )
                
                # Record successful verification
                record_verification_event(
                    success=True,
                    response_time_ms=response_time,
                    client_ip=remote_ip
                )
                
                return result
                
        except httpx.TimeoutException:
            response_time = (time.time() - start_time) * 1000
            record_verification_event(
                success=False,
                response_time_ms=response_time,
                error_code="timeout",
                client_ip=remote_ip
            )
            raise HTTPException(
                status_code=status.HTTP_408_REQUEST_TIMEOUT,
                detail="Turnstile verification timeout"
            )
        except Exception as e:
            response_time = (time.time() - start_time) * 1000
            
            # If it's already an HTTPException, re-raise it without wrapping
            if isinstance(e, HTTPException):
                record_verification_event(
                    success=False,
                    response_time_ms=response_time,
                    error_code="http_exception",
                    client_ip=remote_ip
                )
                raise
            
            # For other exceptions, wrap them in an HTTPException
            record_verification_event(
                success=False,
                response_time_ms=response_time,
                error_code="exception",
                client_ip=remote_ip
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Turnstile verification error: {str(e)}"
            )
