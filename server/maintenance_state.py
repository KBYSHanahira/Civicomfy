# ================================================
# File: server/maintenance_state.py
# Shared in-memory progress state for maintenance operations
# (Refresh Model Info / Update Thumbnails).
# Module-level dict so it persists across async route calls.
# ================================================

_state = {
    'active': False,
    'operation': None,     # 'refresh' | 'thumbnails'
    'current': 0,
    'total': 0,
    'updated': 0,
    'skipped': 0,
    'failed': 0,
    'current_item': '',    # human-readable label of the item being processed
    'stop_requested': False,
    'skip_current': False,
}


def reset(operation: str, total: int):
    """Call before starting a maintenance loop."""
    _state['active'] = True
    _state['operation'] = operation
    _state['current'] = 0
    _state['total'] = total
    _state['updated'] = 0
    _state['skipped'] = 0
    _state['failed'] = 0
    _state['current_item'] = ''
    _state['stop_requested'] = False
    _state['skip_current'] = False


def update(current: int, updated: int, skipped: int, failed: int):
    """Call after processing each item."""
    _state['current'] = current
    _state['updated'] = updated
    _state['skipped'] = skipped
    _state['failed'] = failed


def set_current_item(label: str):
    """Set the human-readable label of the item currently being processed."""
    _state['current_item'] = label


def request_stop():
    """Signal the running operation to stop after the current item."""
    _state['stop_requested'] = True


def is_stop_requested() -> bool:
    return _state['stop_requested']


def request_skip():
    """Signal the running operation to skip the current item."""
    _state['skip_current'] = True


def consume_skip() -> bool:
    """Return True if a skip was requested, and clear the flag."""
    if _state['skip_current']:
        _state['skip_current'] = False
        return True
    return False


def finish():
    """Call when the operation is complete."""
    _state['active'] = False
    _state['current_item'] = ''
    _state['stop_requested'] = False
    _state['skip_current'] = False


def get_state() -> dict:
    return dict(_state)
