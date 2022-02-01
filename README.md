# LikedSongs

Show off your spotify liked songs in a public playlist

This was created to solve the problem of the liked songs playlist being private. Since there is no option to make this list of songs public this program checks for new liked songs once a minute and adds them to a public playlist.

## Setup

1. Create a spotify application
   - Go to [https://developer.spotify.com/dashboard/](https://developer.spotify.com/dashboard/)
   - Login with your spotify account
   - Press "Create An App" and fill out the required information
   - Within the new app press "Edit Settings"
   - Add `http://localhost:8888/callback` to the Redirect URIs list and press save
   - Copy the client id and client secret from the developer dashboard
2. Create .env file in the project folder
   - In the project folder create a file called `.env`
   - Copy and paste this into the `.env` file, replacing "client_id" and "client_secret" with the values from the spotify developer dashboard (keep the quotes)
     ```bash
     CLIENT_ID="client_id"
     CLIENT_SECRET="client_secret"
     REDIRECT_URI="http://localhost:8888/callback"
     LIKED_SONGS_ID=""
     ```
   - Create a playlist, right-click the name, go to share and press "Copy link to playlist"
     ![Share>Copy link to playlist](https://chr1s.dev/sharex/files/egxslqK.png)
   - The link should look like this `https://open.spotify.com/playlist/5Fmnn1EBIOi498Gr7epVDc?si=55b50f344a49267m`
   - Copy the playlist id from the link which is the string of letters and numbers after `/playlist/` and before `?si=` in the url. In this case the playlist id is `5Fmnn1EBIOi498Gr7epVDc`
   - Paste the playlist id inside the quotes in the `.env` file here `LIKED_SONGS_ID=""`

## Running

To run the program run

```
node .
```

inside the project folder. You should see `Listening on 8888`

Now go to [http://localhost:8888](http://localhost:8888)
and press the button to login to spotify

Once you're logged in press "Sync liked songs with liked songs playlist", now you can close the website and voila! The playlist you created will now begin populating with songs from your liked songs list. Share it with your friends to show them all your liked songs.
