import fetch from "node-fetch";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function apiRequest(url, options) {
  let res = await fetch(url, options);
  // 401 Unauthorized, 429 Rate Limited, 200 OK
  if (res.status == 401) return;

  if (res.status == 429) {
    let retryAfter = res.headers.get("Retry-After"); // In Seconds
    console.log("before");
    await sleep(retryAfter * 1000);
    console.log("after");
    return await fetch(url, options);
  }
  return res;
}
