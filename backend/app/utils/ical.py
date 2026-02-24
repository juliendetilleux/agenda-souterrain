from datetime import datetime, timedelta, timezone
from icalendar import Calendar as ICalendar, Event as ICalEvent, vRecur
from app.models.event import Event


def event_to_ical(event: Event) -> bytes:
    cal = ICalendar()
    cal.add("prodid", "-//Agenda Souterrain//FR")
    cal.add("version", "2.0")
    _add_event(cal, event)
    return cal.to_ical()


def events_to_ical(events: list[Event]) -> bytes:
    cal = ICalendar()
    cal.add("prodid", "-//Agenda Souterrain//FR")
    cal.add("version", "2.0")
    for event in events:
        _add_event(cal, event)
    return cal.to_ical()


def _add_event(cal: ICalendar, event: Event) -> None:
    ical_event = ICalEvent()
    ical_event.add("uid", str(event.id))
    ical_event.add("summary", event.title)
    if event.all_day:
        ical_event.add("dtstart", event.start_dt.date())
        end_date = event.end_dt.date() if event.end_dt.date() > event.start_dt.date() else event.start_dt.date()
        ical_event.add("dtend", (end_date + timedelta(days=1)))
    else:
        ical_event.add("dtstart", event.start_dt)
        ical_event.add("dtend", event.end_dt)
    if event.location:
        ical_event.add("location", event.location)
    if event.notes:
        ical_event.add("description", event.notes)
    if event.latitude is not None and event.longitude is not None:
        ical_event.add("geo", (event.latitude, event.longitude))
    if event.rrule:
        ical_event.add("rrule", vRecur.from_ical(event.rrule))
    ical_event.add("dtstamp", datetime.now(timezone.utc))
    cal.add_component(ical_event)
