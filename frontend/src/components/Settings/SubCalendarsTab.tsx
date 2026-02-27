import { calendarApi } from '../../api/calendars'
import type { CalendarConfig } from '../../types'
import ColoredItemTab from './ColoredItemTab'

interface Props {
  calendar: CalendarConfig
}

export default function SubCalendarsTab({ calendar }: Props) {
  return (
    <ColoredItemTab
      calendar={calendar}
      queryKey="subcalendars"
      i18nPrefix="subcalendars"
      fetchItems={calendarApi.getSubCalendars}
      createItem={calendarApi.createSubCalendar}
      updateItem={calendarApi.updateSubCalendar}
      deleteItem={calendarApi.deleteSubCalendar}
    />
  )
}
