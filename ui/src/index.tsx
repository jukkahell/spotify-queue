import { library } from "@fortawesome/fontawesome-svg-core";
import {
    faArrowCircleUp, faBars, faCheckCircle, faClipboardCheck, faClone, faCog, faDesktop, faExchangeAlt,
    faForward, faGamepad, faLink, faMinusCircle, faMobile, faPauseCircle, faPlayCircle,
    faPlusCircle, faRandom, faShareAlt, faSignOutAlt, faSlidersH, faThumbsDown, faThumbsUp,
    faTrashAlt, faUnlock, faVolumeOff, faVolumeUp
} from "@fortawesome/free-solid-svg-icons";
import "bootstrap/dist/css/bootstrap.min.css";
import * as React from "react";
import * as ReactDOM from "react-dom";
import axios from "../node_modules/axios";
import App from "./App";
import "./index.css";

library.add(
    faDesktop, faMobile, faVolumeOff, faPlayCircle, faVolumeUp,
    faShareAlt, faLink, faBars, faSlidersH, faSignOutAlt, faUnlock,
    faExchangeAlt, faThumbsDown, faThumbsUp, faTrashAlt, faPauseCircle,
    faForward, faCog, faGamepad, faCheckCircle, faRandom, faPlusCircle,
    faMinusCircle, faClone, faArrowCircleUp, faClipboardCheck
);
axios.defaults.withCredentials = true;

ReactDOM.render(
    <App />,
    document.getElementById("root") as HTMLElement
);
