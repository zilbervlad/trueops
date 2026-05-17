from datetime import datetime, timedelta, time
from zoneinfo import ZoneInfo


BUSINESS_TIMEZONE = "America/New_York"
BUSINESS_DAY_CUTOFF_HOUR = 5


def now_local():
    return datetime.now(ZoneInfo(BUSINESS_TIMEZONE))


def business_date():
    """
    TrueOps business day ends at 5:00 AM Eastern.

    Example:
    Tuesday 2:00 AM = Monday business day
    Tuesday 5:00 AM = Tuesday business day
    """
    now = now_local()

    if now.time() < time(BUSINESS_DAY_CUTOFF_HOUR, 0):
        return now.date() - timedelta(days=1)

    return now.date()


def is_past_business_day(target_date):
    return target_date < business_date()


def is_current_business_day(target_date):
    return target_date == business_date()
