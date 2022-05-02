import { library } from "@fortawesome/fontawesome-svg-core";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";
import {
    faAngleDoubleUp, faArrowCircleUp, faBan, faBars, faCheckCircle, faClipboardCheck, faClipboardList, faClone,
    faCog, faCoins, faDesktop, faDice, faEdit, faExchangeAlt, faExclamationTriangle, faForward, faGamepad, faHandshake, faHome,
    faInfinity, faLayerGroup, faLevelUpAlt, faLink, faListOl, faMinusCircle, faMobile, faPauseCircle, faPlayCircle, faPlusCircle,
    faRandom, faSave, faSearch, faShare, faShareAlt, faShieldAlt, faSignInAlt, faSignOutAlt, faSlidersH,
    faStar, faStore, faThumbsDown, faThumbsUp, faTimesCircle, faTrashAlt, faUndo, faUnlock, faUser, faUsers,
    faVolumeOff, faVolumeUp,
} from "@fortawesome/free-solid-svg-icons";
import "bootstrap/dist/css/bootstrap.min.css";
import * as React from "react";
import axios from "axios";
import App from "./App";
import "./index.css";
import { createRoot } from "react-dom/client";

library.add(
    faDesktop, faMobile, faVolumeOff, faPlayCircle, faVolumeUp,
    faShareAlt, faLink, faBars, faSlidersH, faSignOutAlt, faUnlock,
    faExchangeAlt, faThumbsDown, faThumbsUp, faTrashAlt, faPauseCircle,
    faForward, faCog, faGamepad, faCheckCircle, faRandom, faPlusCircle,
    faMinusCircle, faClone, faArrowCircleUp, faClipboardCheck, faShare,
    faSearch, faClipboardList, faDice, faLayerGroup, faTimesCircle, faUsers,
    faUndo, faEdit, faSave, faShieldAlt, faUser, faStar, faHandshake,
    faSignInAlt, faHome, faStore, faLevelUpAlt, faCoins, faBan, faListOl,
    faExclamationTriangle, faAngleDoubleUp, faInfinity, fab, far
);
axios.defaults.withCredentials = true;

const root = createRoot(document.getElementById("root") as HTMLElement);
root.render(<App />);
