const supabase = require("./server/config/supabase");
async function test() {
  const { data, error } = await supabase.from("disruptions").select("*");
  console.log("data:", JSON.stringify(data, null, 2));
  console.log("error:", error);
}
test();
