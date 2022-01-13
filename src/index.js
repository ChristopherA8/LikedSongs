// Server
import express from "express"; // Express web server framework
import request from "request"; // "Request" library
import cors from "cors";
import querystring from "querystring";
import cookieParser from "cookie-parser";

// API
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

// filename and dirname in a module
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Util
import chalk from "chalk";

let client_id = process.env.CLIENT_ID; // Your client id
let client_secret = process.env.CLIENT_SECRET; // Your secret
let redirect_uri = process.env.REDIRECT_URI; // Your redirect uri

let global_refresh_token = "";
let global_access_token = "";

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

// returns colored string with time for console logging
const logPrefix = () => {
  return (
    chalk.whiteBright.bold("|") +
    " " +
    chalk.blue(
      `${new Date().toLocaleTimeString("en-US", {
        timeZone: "America/Chicago",
      })}`
    ) +
    " " +
    chalk.whiteBright.bold("|") +
    " "
  );
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
      "/#" + new URLSearchParams().append("error", "state_mismatch")
      // querystring.stringify({
      //   error: "state_mismatch",
      // })
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
          new Buffer.from(client_id + ":" + client_secret).toString("base64"),
      },
      json: true,
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        let access_token = body.access_token,
          refresh_token = body.refresh_token;

        global_refresh_token = body.refresh_token;
        global_access_token = body.access_token;
        console.log(
          "-------------------------------------------------------------"
        );
        console.log(`refresh_token: ${chalk.green(global_refresh_token)}`);
        console.log(`access_token: ${chalk.green(access_token)}`);
        console.log(
          "-------------------------------------------------------------"
        );
        updater();
        // test();

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
        new Buffer.from(client_id + ":" + client_secret).toString("base64"),
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

const getRefreshedAccessToken = async () => {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", global_refresh_token);

  let res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        new Buffer.from(client_id + ":" + client_secret).toString("base64"),
    },
    body: params,
  });
  let data = await res.json();
  return data.access_token;
};

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
    await sleep(5000);
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
    await sleep(5000);
    await getLikedSongsPlaylist(access_token, data.next, likedSongsMap);
  }
  return { map: likedSongsMap, length: data.total };
};

// This is unused because it includes other stuff too
const getLikedSongsLength = async (access_token) => {
  let res = await fetch(
    "https://api.spotify.com/v1/me/tracks?limit=1&offset=0",
    {
      headers: {
        Authorization: "Bearer " + access_token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );
  let data = await res.json();
  return data.total;
};

const getLikedSongsPlaylistLength = async (access_token) => {
  let res = await fetch(
    `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}/tracks?fields=total&limit=1&offset=0`,
    {
      headers: {
        Authorization: "Bearer " + access_token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );
  let data = await res.json();
  return data.total;
};

// currently unused cause im muy baka
const getLikedSongsPlaylistSnapshotID = async (access_token) => {
  let res = await fetch(
    `https://api.spotify.com/v1/playlists/${process.env.LIKED_SONGS_ID}?fields=snapshot_id`,
    {
      headers: {
        Authorization: "Bearer " + access_token,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );
  let data = await res.json();
  return data.snapshot_id;
};

// not tested since postSongs position param was added
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

const updater = async () => {
  let access_token = global_access_token;

  // Refresh the access token every hour(ish) 58 minutes
  setInterval(async () => {
    access_token = await getRefreshedAccessToken();
    global_access_token = access_token;
    console.log(logPrefix() + "Token refreshed: " + chalk.green(access_token));
  }, 1000 * 60 * 30);

  // Keep liked songs playlist updated with users liked songs
  setInterval(async () => {
    let playlistLength = await getLikedSongsPlaylistLength(access_token);

    let likedSongs = await getLikedSongs(access_token);

    console.log(
      logPrefix() +
        `Liked Songs: ${likedSongs.size} Liked Songs Playlist: ${playlistLength}`
    );

    if (likedSongs.size > playlistLength) {
      let { map, length } = await getLikedSongsPlaylist(access_token);

      let howManySongsToBeAdded = [...likedSongs.values()].slice(
        map.size
      ).length;

      let songsToBeAdded = [...likedSongs.values()].reverse().slice(map.size);
      if (howManySongsToBeAdded > 1) songsToBeAdded = songsToBeAdded.reverse();

      let songNamesToBeAdded = [...likedSongs.keys()].reverse().slice(map.size);
      if (howManySongsToBeAdded > 1)
        songNamesToBeAdded = songNamesToBeAdded.reverse();

      console.log(
        logPrefix() +
          `${
            howManySongsToBeAdded > 1 ? "Added songs:" : "Added song:"
          } ${songNamesToBeAdded.join(", ")}`
      );

      // Split into chunks of 50
      let i,
        j,
        temporary,
        songCount = 0,
        chunk = 50;

      for (i = 0, j = songsToBeAdded.length; i < j; i += chunk) {
        temporary = songsToBeAdded.slice(i, i + chunk);
        await postSongs(temporary, songCount, access_token);
        songCount += 50;
      }
    }
  }, 1000 * 60);
};

const test = async () => {
  let playlistLength = await getLikedSongsPlaylistLength(global_access_token);
  console.log(playlistLength);
  let new_token = await getRefreshedAccessToken();
  console.log(new_token);
  let newPlaylistLength = await getLikedSongsPlaylistLength(new_token);
  console.log(newPlaylistLength);
};
