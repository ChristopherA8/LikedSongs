import fetch from "node-fetch";

export async function getUser(req, res) {
  let data = await fetch("https://api.spotify.com/v1/me", {
    headers: { authorization: "Bearer " + req.headers.authorization },
  });
  let json = await data.json();

  res.json(json);
}
