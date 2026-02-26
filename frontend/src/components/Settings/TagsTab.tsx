import { calendarApi } from '../../api/calendars'
import type { CalendarConfig } from '../../types'
import ColoredItemTab from './ColoredItemTab'

interface Props {
  calendar: CalendarConfig
}

export default function TagsTab({ calendar }: Props) {
  return (
    <ColoredItemTab
      calendar={calendar}
      queryKey="tags"
      i18nPrefix="tags"
      fetchItems={calendarApi.getTags}
      createItem={calendarApi.createTag}
      updateItem={calendarApi.updateTag}
      deleteItem={calendarApi.deleteTag}
    />
  )
}
