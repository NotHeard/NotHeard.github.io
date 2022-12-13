// s/o https://stackoverflow.com/a/48660722
// Get the hash of the url

const usePrivateScope = true;

const hash = window.location.hash
.substring(1)
.split('&')
.reduce(function (initial, item) {
  if (item) {
    var parts = item.split('=');
    initial[parts[0]] = decodeURIComponent(parts[1]);
  }
  return initial;
}, {});
window.location.hash = '';

// Set token
let _token = hash.access_token;

const authEndpoint = 'https://accounts.spotify.com/authorize';

// Replace with your app's client ID, redirect URI and desired scopes
const clientId = '57b0f934888642a1be294898d2ba21e7';
const redirectUri = 'http://localhost:5555';
let scopes = [];
if (usePrivateScope == true){
    scopes = [
        'user-read-playback-state',
        'playlist-read-private',
        'user-modify-playback-state',
        'streaming'
    ];
}


// If there is no token, redirect to Spotify authorization
if (!_token) {
  window.location = `${authEndpoint}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes.join('%20')}&response_type=token`;
}