import time
from datetime import datetime


class log_agent_step:
    """Helper to time and format agent_logs entries consistently."""

    @staticmethod
    def start() -> float:
        return time.time()

    @staticmethod
    def finish(start: float, agent_name: str, action: str,
               input_summary: str = "", output_summary: str = "",
               status: str = "success") -> dict:
        duration_ms = int((time.time() - start) * 1000)
        return {
            "agent_name": agent_name,
            "action": action,
            "input_summary": input_summary[:500],
            "output_summary": output_summary[:500],
            "status": status,
            "duration_ms": duration_ms,
            "created_at": datetime.utcnow().isoformat(),
        }
