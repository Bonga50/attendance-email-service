import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { RRule } from "https://cdn.skypack.dev/rrule?dts";
import { CalendarEvent } from "https://cdn.skypack.dev/angular-calendar?dts";
import { addMonths, subMonths } from "https://cdn.skypack.dev/date-fns@2.21.1?dts";

const handler = async (req: Request): Promise<Response> => {
  try {
    const { supabaseUrl, supabaseKey, resendApiKey, backendUrl } =
      await req.json();

    if (!supabaseUrl || !supabaseKey || !resendApiKey || !backendUrl) {
      throw new Error("Missing required environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Rest of your existing code...
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    let earliestStartTime: any;
    let latestEndTime: any;
    let storedEvents: any[] = [];
    const eventsByTeacher: Record<
      string,
      { name: string; events: any[]; id?: string }
    > = {};

    // Fetch the events from the API
    const eventRes = await fetch(`${backendUrl}api/GoogleCalendar`);

    if (!eventRes.ok) {
      console.error(`Fetch request failed with status: ${eventRes.status}`);
      return new Response("Failed to fetch event data", {
        status: eventRes.status,
      });
    }

    
      // Create a calendar event object.
      const createCalendarEvent = (
        event: any,
        start?: Date,
        end?: Date
      ): CalendarEvent => {
        start = start ?? new Date(event.start.dateTime);
        end = end ?? new Date(event.end.dateTime);

        updateEventTimes(start, end);

        return {
          start: start ?? new Date(event.start.dateTime),
          end: end ?? new Date(event.end.dateTime),
          title: event.summary ?? "",
          meta: {
            location: event.location ?? "",
            teacherName:
              event.extendedProperties?.private?.teacher?.split("|")[1] ?? "",
            teacherEmail:
              event.extendedProperties?.private?.teacher?.split("|")[0] ?? "",
            subjects: event.extendedProperties?.private?.subject ?? "",
            grade: event.extendedProperties?.private?.grade ?? "",
            event_id: event.id ?? "",
            event_title: event.summary ?? "",
            event_type: event.extendedProperties?.private?.eventType ?? "",
            isRecurring: event.recurrence ? true : false,
            capacity: event.extendedProperties?.private?.capacity ?? "",
            isDeleted: event.status === "cancelled" ? true : false,
            originalStartDate: event.start.dateTime,
            originalEndDate: event.end.dateTime,
            instanceDate: start ?? new Date(event.start.dateTime),
            attendees: event.attendees
              ? event.attendees.map((attendee: any) => ({
                  email: attendee.email,
                  name: attendee.displayName,
                  responseStatus: attendee.responseStatus,
                }))
              : [],
            startTime: start ?? new Date(event.start.dateTime),
            endTime: end ?? new Date(event.end.dateTime),
            eventType: event.extendedProperties.private.eventType ?? "",
            originalEvent: event,
            timeZone: event.end.timeZone,
            gradeName: event.extendedProperties.private.grade,
          },
        };
      };

      // Update earliest and latest event times.
      const updateEventTimes = (start: Date, end: Date): void => {
        const eventStartTime = start.getHours(); // Get event start hour.
        const eventEndTime = end.getHours(); // Get event end hour.
        if (eventStartTime < earliestStartTime) {
          earliestStartTime = eventStartTime; // Update earliest start time if necessary.
        }
        if (eventEndTime > latestEndTime) {
          latestEndTime = eventEndTime; // Update latest end time if necessary.
        }
      };

      // Check if two dates have the same date and time.
      const isSameDateTime = (date1: Date, date2: Date): boolean => {
        return (
          date1.getFullYear() === date2.getFullYear() &&
          date1.getMonth() === date2.getMonth() &&
          date1.getDate() === date2.getDate() &&
          date1.getHours() === date2.getHours() &&
          date1.getMinutes() === date2.getMinutes()
        );
      };

    const processEvents = async (events: any[]): Promise<void> => {
        console.log(events.length);
        const recurringEvents = events.filter((event) => event.recurrence); // Filter recurring events.
        const exceptionEvents = events.filter(
          (event) => event.recurringEventId && event.status !== "cancelled"
        ); // Filter exception events.
        const cancelledEvents = events.filter(
          (event) => event.status === "cancelled" && event.recurringEventId
        ); // Filter cancelled events.

        const oneMonthBack = subMonths(new Date(), 1);
        const sixMonthsForward = addMonths(new Date(), 6);

        recurringEvents.forEach((event) => {
          const eventStart = new Date(event.start.dateTime);
          const ruleString = event.recurrence[0];
          const rule = new RRule({
            ...RRule.parseString(ruleString),
            dtstart: eventStart < oneMonthBack ? oneMonthBack : eventStart, // Use oneMonthBack only if eventStart is earlier than oneMonthBack
            until: sixMonthsForward,
          });

          // Override the `until` date if it exists in the rule itself and is before the sixMonthsForward limit
          const ruleOptions = RRule.parseString(ruleString);
          const ruleUntilDate = ruleOptions.until;

          const finalUntilDate =
            ruleUntilDate && ruleUntilDate < sixMonthsForward
              ? ruleUntilDate
              : sixMonthsForward;
          rule.options.until = finalUntilDate;

          const dates = rule.all(); // Get all occurrences based on the rule.

          dates.forEach((date: any) => {
            const instanceStart = new Date(
              date.setHours(eventStart.getHours(), eventStart.getMinutes())
            ); // Calculate instance start time.
            const instanceEnd = new Date(
              date.setHours(
                new Date(event.end.dateTime).getHours(),
                new Date(event.end.dateTime).getMinutes()
              )
            ); // Calculate instance end time.

            updateEventTimes(instanceStart, instanceEnd); // Update earliest and latest times.

            const isCancelled = cancelledEvents.some((cancelledEvent) => {
              const cancelledStart = new Date(
                cancelledEvent.originalStartTime.dateTime
              );
              return (
                isSameDateTime(cancelledStart, instanceStart) &&
                cancelledEvent.recurringEventId === event.id
              );
            });

            if (isCancelled) {
              return; // Skip cancelled instances.
            }

            const updatedInstance = exceptionEvents.find((updatedEvent) => {
              const updatedStart = new Date(
                updatedEvent.originalStartTime.dateTime
              ); // Parse updated event start date.
              return (
                isSameDateTime(updatedStart, instanceStart) &&
                updatedEvent.recurringEventId === event.id
              ); // Check if instance is updated.
            });

            if (updatedInstance) {
              storedEvents.push(createCalendarEvent(updatedInstance)); // Create calendar event for updated instance.
            } else {
              storedEvents.push(
                createCalendarEvent(event, instanceStart, instanceEnd)
              ); // Create calendar event for instance.
            }
          });
        });

        // Process non-recurring events.
        events.forEach((event) => {
          if (!event.recurrence && !event.recurringEventId) {
            const eventStart = new Date(event.start.dateTime); // Parse event start date.
            const eventEnd = new Date(event.end.dateTime); // Parse event end date.

            updateEventTimes(eventStart, eventEnd); // Update earliest and latest times.

            storedEvents.push(createCalendarEvent(event)); // Create calendar event for non-recurring event.
          }
        });

        // Filter all calendar events for the current day.
        const eventsToday = storedEvents.filter((event: any) => {
          const startDateTime = new Date(event.meta.startTime).toISOString();
          const endDateTime = new Date(event.meta.endTime).toISOString();

          const isToday =
            (startDateTime >= todayStart && startDateTime <= todayEnd) ||
            (endDateTime >= todayStart && endDateTime <= todayEnd);

          const isClass = event.meta.eventType === "Class";

          const isNotCancelled = event.meta.isDeleted !== "cancelled";

          return isToday && isClass && isNotCancelled;
        });

        // Store the event ids.
        const eventIdsToday = eventsToday.map(
          (event: any) => event.meta.event_id
        );

        // Fetch all attendance registers.
        const { data: attendanceTaken, error } = await supabase
          .from("Attendance_Register")
          .select("event_Id")
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd);

        // Display an error message if attendance registers could not be fetched.
        if (error) {
          console.error("Error fetching attendance registers:", error);
        }

        // Store all event ids from the attendance registers.
        const attendanceIds = attendanceTaken?.map(
          (attendance: any) => attendance.event_Id
        );

        // Find event ids that are not in the attendance registers.
        const missingEventIds = eventIdsToday.filter(
          (eventId: string) => !attendanceIds?.includes(eventId)
        );

        await Promise.all(
          missingEventIds.map(async (missingEventId: any) => {
            const missingEvent = eventsToday.find(
              (event: any) => event.meta.event_id === missingEventId
            );

            const teacherEmail = missingEvent.meta.teacherEmail;
            const teacherName = missingEvent.meta.teacherName;

            if (!eventsByTeacher[teacherEmail]) {
              eventsByTeacher[teacherEmail] = { name: teacherName, events: [] };
            }

            eventsByTeacher[teacherEmail].events.push(missingEvent);

            // Process each teachers' information.
            const { data: teacherID, error: teacherIDError } = await supabase
              .from("profiles")
              .select("id")
              .eq("email_address", teacherEmail)
              .single();

            if (teacherIDError) {
              console.error(
                `Error fetching teacher ID for ${teacherEmail}:`,
                teacherIDError
              );
            } else {
              // Store the teacher's id.
              eventsByTeacher[teacherEmail].id = teacherID?.id;
            }
          })
        );
      };

    const eventData = await eventRes.json();
    console.log("processing events");
    await processEvents(eventData);


    const formatTime = (
      dateString: string | number | Date,
      timeZone: string
    ) => {
      const date = new Date(dateString);
      const options: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
        timeZone: timeZone,
      };
      return date.toLocaleTimeString("en-US", options);
    };

    // Format email content for each teacher
    const formatNewSubjectTableAsHTML = (data: any[]): string => {
      // Format date
      const formatDate = (dateString: string | number | Date) => {
        const date = new Date(dateString);
        const options: Intl.DateTimeFormatOptions = {
          year: "numeric",
          month: "long",
          day: "numeric",
        };
        return date.toLocaleDateString("en-US", options);
      };

      const rows = data
        .map((event: any) => {
          const timeZone = event.meta.timeZone || "UTC";
          const startTime = event.meta.startTime;
          const subjectName = event.meta.subjects;
          const locationName = event.meta.location;
          const gradeName = event.meta.gradeName;
          const teacherEmail = event.meta.teacherEmail;
          const bookedStudents = event.meta.attendees
            .filter((attendee: any) => attendee.email !== teacherEmail)
            .map((attendee: any) => attendee.name)
            .join(", ");

          // Provide a default message if no students are booked.
          const studentDisplay = bookedStudents || "No students for this class";

          return `
              <tr style="font-family: 'Poppins-Medium', Helvetica;">
              <td style="padding: 8px; background-color: #f2f2f2; text-align: left;">${formatDate(
                startTime
              )}</td>
              <td style="padding: 8px; background-color: #f2f2f2; text-align: left;">${subjectName}</td>
              <td style="padding: 8px; background-color: #f2f2f2; text-align: left;">${gradeName}</td>
              <td style="padding: 8px; background-color: #f2f2f2; text-align: left;">${formatTime(
                startTime,
                timeZone
              )}</td>
              <td style="padding: 8px; background-color: #f2f2f2; text-align: left;">${locationName}</td>
              <td style="padding: 8px; background-color: #f2f2f2; text-align: left;">${studentDisplay}</td>
            </tr>
          `;
        })
        .join("");

      return `
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ccc; border-radius: 10px; overflow: hidden;">
            <tr style="background-color: #c3dafe; font-weight: bold; text-align: left; font-family: 'Poppins-Medium', Helvetica;">
              <th style="padding: 8px;" colspan="6">Attendance has not been captured</th>
            </tr>
            <tr style="font-family: 'Poppins-Medium', Helvetica;">
              <th style="padding: 8px; background-color: #f2f2f2; text-align: left;">Date</th>
              <th style="padding: 8px; background-color: #f2f2f2; text-align: left;">Subject</th>
              <th style="padding: 8px; background-color: #f2f2f2; text-align: left;">Grade</th>
              <th style="padding: 8px; background-color: #f2f2f2; text-align: left;">Time</th>
              <th style="padding: 8px; background-color: #f2f2f2; text-align: left;">Location</th>
              <th style="padding: 8px; background-color: #f2f2f2; text-align: left;">Booked Students</th>
            </tr>
            ${rows}
          </table>
        `;
    };

    for (const [
      teacherEmail,
      { name: teacherName, events: teacherEvents, id: teacherID },
    ] of Object.entries(eventsByTeacher)) {
      const emailContent = formatNewSubjectTableAsHTML(teacherEvents);

      const htmlContent = `<html>
              <body>
                <div dir="ltr">Dear ${teacherName}
                  <div>
                  <br>
                  <p>How should the world of Edify know which lives you changed if you don't tell us? </p>
                  <br>
                  ${emailContent}
                </div>
                <div>
                  <br>
                </div>
                <br>
                <p>Thank you for your attention to this issue.</p>
                <p>
                  <font size="1">-----------------------------------------------------------------------------</font>
                </p>
                <p>
                  <font size="1">IMPORTANT: The contents of this email and any attachments are confidential. They are intended for the named recipient(s) only. If you have received this email by mistake, please notify the sender immediately and do not disclose the contents to anyone or make copies thereof.</font>
                </p>
                <div>Best regards, <br clear="all">
                  <div>
                    <div dir="ltr" class="gmail_signature">
                      <div dir="ltr">
                        <img src="https://zyiyzsojwcrqitritzxg.supabase.co/storage/v1/object/public/email/Edify_Signature.png?t=2024-06-13T08%3A08%3A38.491Z" alt="image.png" width="401" height="200" class="gmail-CToWUd gmail-a6T" tabindex="0" style="cursor: pointer; outline: 0px;">
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </body>
            </html>`;
      await supabase.from("Notification").insert({
        body: emailContent,
        profile_Id: teacherID,
        Notification_Name: "No Attendance",
        is_read: false,
      });

      const send = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "team@jushumans.co.za",
          to: teacherEmail,
          subject: "Roll Call - Attendance Missing",
          html: htmlContent,
        }),
      });
    }

    return new Response("Processing complete", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

// Export the handler for Deno Deploy
export default handler;


