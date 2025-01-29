import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { RRule } from "https://cdn.skypack.dev/rrule?dts";
import { CalendarEvent } from "https://cdn.skypack.dev/angular-calendar?dts";
import { addMonths, subMonths } from "https://cdn.skypack.dev/date-fns@2.21.1?dts";

const handler = async (req: Request): Promise<Response> => {
  try {
    console.log("hello")
    // const { supabaseUrl, supabaseKey, resendApiKey, backendUrl } =
    //   await req.json();

    // if (!supabaseUrl || !supabaseKey || !resendApiKey || !backendUrl) {
    //   throw new Error("Missing required environment variables");
    // }

    // const supabase = createClient(supabaseUrl, supabaseKey);

    // // Rest of your existing code...
    // const today = new Date();
    // const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    // const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();
    // let earliestStartTime: any;
    // let latestEndTime: any;
    // let storedEvents: any[] = [];
    // const eventsByTeacher: Record<
    //   string,
    //   { name: string; events: any[]; id?: string }
    // > = {};

    // // Fetch the events from the API
    // const eventRes = await fetch(`${backendUrl}api/GoogleCalendar`);
    // console.log(eventRes)
    // if (!eventRes.ok) {
    //   console.error(`Fetch request failed with status: ${eventRes.status}`);
    //   return new Response("Failed to fetch event data", {
    //     status: eventRes.status,
    //   });
    // }

    return new Response("Processing complete", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

// Export the handler for Deno Deploy
export default handler;


