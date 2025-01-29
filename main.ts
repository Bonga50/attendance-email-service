//import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
// import { RRule } from "https://esm.sh/rrule";
// import { CalendarEvent } from "https://esm.sh/angular-calendar";
// import { addMonths, subMonths } from "https://esm.sh/date-fns@2.21.1";

const handler = async (req: Request): Promise<Response> => {
  try {
    console.log("hello");
    return new Response("Processing complete", { status: 200 });
  } catch (error) {
    console.error("Error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};

export default handler;
