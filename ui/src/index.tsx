import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./App";
import "./index.css";
import registerServiceWorker from "./registerServiceWorker";

const client_id = "da6ea27d63384e858d12bcce0fac006d";
const redirect_uri = "http://localhost:8000/callback";

const url = "https://accounts.spotify.com/authorize" +
    "?client_id=" + client_id +
    "&response_type=code" +
    "&scope=user-modify-playback-state,user-read-currently-playing,user-read-playback-state" +
    "&redirect_uri=" + encodeURIComponent(redirect_uri);

window.open(url, "asdf", "WIDTH=400,HEIGHT=500");

ReactDOM.render(
  <App />,
  document.getElementById("root") as HTMLElement
);
registerServiceWorker();
