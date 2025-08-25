"""
Turnstile monitoring and analytics module.

This module provides monitoring capabilities for Cloudflare Turnstile verification,
including success rates, error tracking, and performance metrics.
"""

import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass
from collections import defaultdict, deque
import logging

logger = logging.getLogger(__name__)


@dataclass
class TurnstileEvent:
    """Represents a single Turnstile verification event."""
    timestamp: datetime
    success: bool
    response_time_ms: float
    error_code: Optional[str] = None
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None


class TurnstileMonitor:
    """Monitors Turnstile verification performance and success rates."""
    
    def __init__(self, max_events: int = 1000):
        self.max_events = max_events
        self.events: deque = deque(maxlen=max_events)
        self.success_count = 0
        self.failure_count = 0
        self.total_response_time = 0.0
        self.error_counts: Dict[str, int] = defaultdict(int)
        self.ip_counts: Dict[str, int] = defaultdict(int)
        
    def record_event(self, event: TurnstileEvent) -> None:
        """Record a Turnstile verification event."""
        self.events.append(event)
        
        if event.success:
            self.success_count += 1
        else:
            self.failure_count += 1
            if event.error_code:
                self.error_counts[event.error_code] += 1
        
        self.total_response_time += event.response_time_ms
        
        if event.client_ip:
            self.ip_counts[event.client_ip] += 1
            
        logger.debug(f"Recorded Turnstile event: success={event.success}, "
                    f"response_time={event.response_time_ms}ms, "
                    f"error_code={event.error_code}")
    
    def get_success_rate(self, time_window: Optional[timedelta] = None) -> float:
        """Calculate success rate within optional time window."""
        if time_window:
            cutoff = datetime.now() - time_window
            recent_events = [e for e in self.events if e.timestamp >= cutoff]
            if not recent_events:
                return 0.0
            successful = sum(1 for e in recent_events if e.success)
            return successful / len(recent_events)
        
        total = self.success_count + self.failure_count
        return self.success_count / total if total > 0 else 0.0
    
    def get_average_response_time(self, time_window: Optional[timedelta] = None) -> float:
        """Calculate average response time within optional time window."""
        if time_window:
            cutoff = datetime.now() - time_window
            recent_events = [e for e in self.events if e.timestamp >= cutoff]
            if not recent_events:
                return 0.0
            total_time = sum(e.response_time_ms for e in recent_events)
            return total_time / len(recent_events)
        
        total = self.success_count + self.failure_count
        return self.total_response_time / total if total > 0 else 0.0
    
    def get_error_breakdown(self, time_window: Optional[timedelta] = None) -> Dict[str, int]:
        """Get error code breakdown within optional time window."""
        if time_window:
            cutoff = datetime.now() - time_window
            recent_events = [e for e in self.events if e.timestamp >= cutoff]
            error_counts = defaultdict(int)
            for event in recent_events:
                if not event.success and event.error_code:
                    error_counts[event.error_code] += 1
            return dict(error_counts)
        
        return dict(self.error_counts)
    
    def get_top_ips(self, limit: int = 10, time_window: Optional[timedelta] = None) -> List[tuple]:
        """Get top IP addresses by request count."""
        if time_window:
            cutoff = datetime.now() - time_window
            recent_events = [e for e in self.events if e.timestamp >= cutoff]
            ip_counts = defaultdict(int)
            for event in recent_events:
                if event.client_ip:
                    ip_counts[event.client_ip] += 1
        else:
            ip_counts = self.ip_counts
        
        return sorted(ip_counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    
    def get_stats_summary(self, time_window: Optional[timedelta] = None) -> Dict:
        """Get comprehensive statistics summary."""
        return {
            "success_rate": self.get_success_rate(time_window),
            "average_response_time_ms": self.get_average_response_time(time_window),
            "total_events": len(self.events),
            "error_breakdown": self.get_error_breakdown(time_window),
            "top_ips": self.get_top_ips(5, time_window),
            "time_window": str(time_window) if time_window else "all_time"
        }
    
    def reset_stats(self) -> None:
        """Reset all statistics."""
        self.events.clear()
        self.success_count = 0
        self.failure_count = 0
        self.total_response_time = 0.0
        self.error_counts.clear()
        self.ip_counts.clear()
        logger.info("Turnstile monitor statistics reset")


# Global monitor instance
turnstile_monitor = TurnstileMonitor()


def record_verification_event(
    success: bool,
    response_time_ms: float,
    error_code: Optional[str] = None,
    client_ip: Optional[str] = None,
    user_agent: Optional[str] = None
) -> None:
    """Record a Turnstile verification event in the global monitor."""
    event = TurnstileEvent(
        timestamp=datetime.now(),
        success=success,
        response_time_ms=response_time_ms,
        error_code=error_code,
        client_ip=client_ip,
        user_agent=user_agent
    )
    turnstile_monitor.record_event(event)


def get_turnstile_stats(time_window: Optional[timedelta] = None) -> Dict:
    """Get Turnstile statistics from the global monitor."""
    return turnstile_monitor.get_stats_summary(time_window)
