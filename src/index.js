import express from "express"; // Express web server framework
import request from "request"; // "Request" library
import cors from "cors";
import querystring from "querystring";
import cookieParser from "cookie-parser";

import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// import spotifyAPI from "spotify-web-api-js";

let client_id = process.env.CLIENT_ID; // Your client id
let client_secret = process.env.CLIENT_SECRET; // Your secret
let redirect_uri = process.env.REDIRECT_URI; // Your redirect uri

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let generateRandomString = function (length) {
  let text = "";
  let possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

let stateKey = "spotify_auth_state";

let app = express();

app
  .use(express.static(__dirname + "/public"))
  .use(cors())
  .use(cookieParser());

app.get("/login", function (req, res) {
  let state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  let scope =
    "playlist-modify-public playlist-modify-private playlist-read-private user-library-read";
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: client_id,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state,
      })
  );
});

app.get("/callback", function (req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect(
      "/#" +
        querystring.stringify({
          error: "state_mismatch",
        })
    );
  } else {
    res.clearCookie(stateKey);
    let authOptions = {
      url: "https://accounts.spotify.com/api/token",
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code",
      },
      headers: {
        Authorization:
          "Basic " +
          new Buffer(client_id + ":" + client_secret).toString("base64"),
      },
      json: true,
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        let access_token = body.access_token,
          refresh_token = body.refresh_token;

        console.log(access_token);
        updater(access_token);
        // spotifyAPI.setAccessToken(access_token);

        let options = {
          url: "https://api.spotify.com/v1/me",
          headers: { Authorization: "Bearer " + access_token },
          json: true,
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          // console.log(body);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect(
          "/#" +
            querystring.stringify({
              access_token: access_token,
              refresh_token: refresh_token,
            })
        );
      } else {
        res.redirect(
          "/#" +
            querystring.stringify({
              error: "invalid_token",
            })
        );
      }
    });
  }
});

app.get("/refresh_token", function (req, res) {
  // requesting access token from refresh token
  let refresh_token = req.query.refresh_token;
  let authOptions = {
    url: "https://accounts.spotify.com/api/token",
    headers: {
      Authorization:
        "Basic " +
        new Buffer(client_id + ":" + client_secret).toString("base64"),
    },
    form: {
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    },
    json: true,
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      let access_token = body.access_token;
      res.send({
        access_token: access_token,
      });
    }
  });
});

console.log("Listening on 8888");
app.listen(8888);

const getLikedSongs = async (
  access_token,
  url = "https://api.spotify.com/v1/me/tracks?limit=50&offset=0",
  likedSongs = new Map()
) => {
  let res = await fetch(url, {
    headers: {
      Authorization: "Bearer " + access_token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  let data = await res.json();

  for (const item of data.items) {
    likedSongs.set(item.track.name, item.track.uri);
  }

  if (data.next) {
    sleep(5000);
    await getLikedSongs(access_token, data.next, likedSongs);
  }
  return likedSongs;
};

const getLikedSongsPlaylist = async (
  access_token,
  url = `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}/tracks?limit=50&offset=0`,
  likedSongsMap = new Map()
) => {
  let res = await fetch(url, {
    headers: {
      Authorization: "Bearer " + access_token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  let data = await res.json();

  for (const item of data.items) {
    likedSongsMap.set(item.track.name, item.track.uri);
  }

  if (data.next) {
    sleep(5000);
    await getLikedSongsPlaylist(access_token, data.next, likedSongsMap);
  }
  return { map: likedSongsMap, length: data.total };
};

const copyLikedSongs = (
  access_token,
  url = "https://api.spotify.com/v1/me/tracks?limit=50&offset=0"
) => {
  let likedSongs = new Map();

  fetch(url, {
    headers: {
      Authorization: "Bearer " + access_token,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then((res) => {
      for (const item of res.items) {
        // console.log(
        //   `Name: ${item.track.name}, Id: ${item.track.id}, uri: ${item.track.uri}, href: ${item.track.href}, addedAt: ${item.added_at}`
        // );
        likedSongs.set(item.track.name, item.track.uri);
      }
      // console.log(`Limit: ${res.limit}, Next: ${res.next}`);
      postSongs([...likedSongs.values()].join(","), 0, access_token);
      // recursion go brrr
      if (res.next) copyLikedSongs(access_token, res.next);
    });
};

const postSongs = async (likedSongs, position = 0, access_token) => {
  if (likedSongs.length > 100) return console.log("Array exceeds 100 songs");

  let body = { uris: likedSongs };

  let res = await fetch(
    `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}/tracks?position=${position}`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + access_token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  let data = await res.json();

  // console.log(JSON.stringify(data));
};

const updater = async (access_token) => {
  setInterval(async () => {
    let likedSongs = await getLikedSongs(access_token);
    let { map, length } = await getLikedSongsPlaylist(access_token);
    console.log(
      `Liked Songs: ${likedSongs.size} Liked Songs Playlist: ${length}(data.total) ${map.size}(map.size)`
    );

    if (likedSongs.size > length) {
      let howManySongsToBeAdded = [...likedSongs.values()].slice(
        map.size
      ).length;

      let songsToBeAdded = [...likedSongs.values()].reverse().slice(map.size);
      if (howManySongsToBeAdded > 1) songsToBeAdded = songsToBeAdded.reverse();

      // if (length) songsToBeAdded = songsToBeAdded.reverse();

      // Split into chunks of 50
      let i,
        j,
        temporary,
        songCount = 0,
        // songCount = length ? 0 : length,
        chunk = 50;

      for (i = 0, j = songsToBeAdded.length; i < j; i += chunk) {
        temporary = songsToBeAdded.slice(i, i + chunk);
        await postSongs(temporary, songCount, access_token);
        songCount += 50;
      }
    }
  }, 1000 * 60);
};
