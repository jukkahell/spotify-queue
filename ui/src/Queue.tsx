import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import { IUser } from "./App";
import config from "./config";
import { IPerk, PerkName } from "./PerkStore";
import { ISettings } from "./Settings";
import Track, { ITrackProps } from "./Track";

export interface IQueuedItem {
  id: string;
  track: ITrackProps;
  userId: string;
  votes: IVote[];
  protected: boolean;
  source: "spotify" | "youtube";
  playlistTrack: boolean;
}

export interface IVote {
  userId: string;
  value: number;
}

interface IQueueProps {
  onQueued: () => void;
  onError: (msg: string) => void;
  onSkip: () => void;
  onRemove: () => void;
  onProtected: () => void;
  onToggleFromFavorites: (trackId: string, source: string, isFavorite: boolean) => void;
  queue: IQueuedItem[] | null;
  currentTrack: IQueuedItem | null;
  settings: ISettings | null;
  user: IUser | null;
  perks: IPerk[] | null;
  isOwner: boolean;
}

interface IQueueState {
  contextMenuId: string | null;
  contextMenuTrack: IQueuedItem | null;
  contextMenuTargetPlaying: boolean;
  contextMenuIndex: number;
}

export class Queue extends React.Component<IQueueProps, IQueueState> {

  public constructor(props: IQueueProps) {
    super(props);

    this.state = {
      contextMenuId: null,
      contextMenuTrack: null,
      contextMenuTargetPlaying: false,
      contextMenuIndex: 0,
    };

    this.removeFromQueue = this.removeFromQueue.bind(this);
    this.showContextMenu = this.showContextMenu.bind(this);
    this.protectTrack = this.protectTrack.bind(this);
    this.hideMenu = this.hideMenu.bind(this);
    this.moveUp = this.moveUp.bind(this);
    this.moveFirst = this.moveFirst.bind(this);
    this.calculateProtectCost = this.calculateProtectCost.bind(this);
  }

  protected renderCurrentTrack() {
    if (!this.props.currentTrack) {
      return null;
    }
    return (
      <li key="currentTrack">
        <div className="dropup">
          <Track
            name={this.props.currentTrack.track.name}
            artist={this.props.currentTrack.track.artist}
            id={this.props.currentTrack.id}
            trackId={this.props.currentTrack.track.id}
            artistId={this.props.currentTrack.track.artistId}
            duration={this.props.currentTrack.track.duration}
            key={"current-" + this.props.currentTrack.track.id}
            index={-1}
            isPlaying={true}
            source={this.props.currentTrack.source}
            protectedTrack={this.props.currentTrack.protected}
            owned={this.props.user!.id === this.props.currentTrack.userId}
            isFavorite={this.props.currentTrack.track.isFavorite}
            selectTrack={this.showContextMenu}
            toggleFromFavorites={this.props.onToggleFromFavorites} />
          <div className={"dropdown-menu " + (this.state.contextMenuId === this.props.currentTrack.id ? "show" : "hide")} aria-labelledby="deviceMenuButton">
            {this.renderContextMenu()}
          </div>
        </div>
      </li>
    );
  }

  protected removeFromQueue(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    axios.delete(config.backend.url + "/removeFromQueue", {
      data: {
        trackId: this.state.contextMenuTrack!.id,
        isPlaying: this.state.contextMenuTargetPlaying
      }
    }).then(() => {
      if (this.state.contextMenuTargetPlaying) {
        this.props.onSkip();
      } else {
        this.props.onRemove();
      }
      this.setState({
        contextMenuId: null,
        contextMenuTrack: null,
        contextMenuTargetPlaying: false
      });
    }).catch(err => {
      this.props.onError(err.response.data.message);
    });
  }

  protected protectTrack(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    axios.post(config.backend.url + "/protectTrack", {
      trackId: this.state.contextMenuTrack!.id,
      isPlaying: this.state.contextMenuTargetPlaying
    }).then(() => {
      this.props.onProtected();
      this.setState({
        contextMenuId: null,
        contextMenuTrack: null,
        contextMenuTargetPlaying: false
      });
    }).catch(err => {
      this.props.onError(err.response.data.message);
    });
  }

  protected moveUp(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    axios.post(config.backend.url + "/moveUpInQueue", {
      trackId: this.state.contextMenuTrack!.id
    }).then(() => {
      this.props.onQueued();
      this.setState({
        contextMenuId: null,
        contextMenuTrack: null,
        contextMenuTargetPlaying: false
      });
    }).catch(err => {
      this.props.onError(err.response.data.message);
    });
  }

  protected moveFirst(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    if (this.props.perks!.find(perk => perk.name === "move_first")!.cooldownLeft! > 0) {
      return;
    }

    axios.post(config.backend.url + "/moveFirstInQueue", {
      trackId: this.state.contextMenuTrack!.id
    }).then(() => {
      this.props.onQueued();
      this.setState({
        contextMenuId: null,
        contextMenuTrack: null,
        contextMenuTargetPlaying: false
      });
    }).catch(err => {
      this.props.onError(err.response.data.message);
    });
  }

  protected renderContextMenu() {
    if (!this.state.contextMenuTrack) {
      return null;
    }

    const menu = [];
    const playlistTrackForOwner = this.state.contextMenuTrack.playlistTrack && this.props.isOwner;
    const trackOwner = this.state.contextMenuTrack.userId === this.props.user!.id;
    const removePerkLevel = this.userPerkLevel("remove_song");
    const moveUpPerkLevel = this.userPerkLevel("move_up");
    const skipPerkLevel = this.userPerkLevel("skip_song");
    const protectPerkLevel = this.userPerkLevel("protect_song");
    const moveFirstPerkLevel = this.userPerkLevel("move_first");
    const removeOrSkipPerkLevel = this.state.contextMenuTargetPlaying ? skipPerkLevel : removePerkLevel;
    const skipCost = this.calculateSkipCost(this.state.contextMenuTrack.track, removeOrSkipPerkLevel);
    const showPoints =
      (this.props.settings!.gamify && !trackOwner && !playlistTrackForOwner)
        ? "(-" + skipCost + " pts)"
        : "";
    if (!this.state.contextMenuTargetPlaying) {
      if (trackOwner || removePerkLevel > 0) {
        menu.push(
          <a className={"dropdown-item"} key={"removeFromQueue"} href="#" onClick={this.removeFromQueue}>
            <FontAwesomeIcon icon="trash-alt" /> Remove from queue {showPoints}
          </a>
        );
      }
      if (this.state.contextMenuIndex > 0 && moveUpPerkLevel > 0) {
        menu.push(
          <a className={"dropdown-item"} key={"moveUp"} href="#" onClick={this.moveUp}>
            <FontAwesomeIcon icon="arrow-circle-up" /> Move up in queue (-5 pts)
          </a>
        );
      }
      if (this.state.contextMenuIndex > 0 && moveFirstPerkLevel > 0) {
        const perk = this.props.perks!.find(perk => perk.name === "move_first")!;
        const cooldownLeft = perk.cooldownLeft!;
        menu.push(
          <a className={"dropdown-item" + (cooldownLeft ? " disabled" : "")} key={"moveFirst"} href="#" onClick={this.moveFirst}>
            <FontAwesomeIcon icon="angle-double-up" /> {"Move first " + (cooldownLeft > 0 ? `(${cooldownLeft} min cooldown)` : "")}
          </a>
        );
      }
    } else if (playlistTrackForOwner || trackOwner || skipPerkLevel > 0) {
      menu.push(
        <a className={"dropdown-item"} key={"removeFromQueue"} href="#" onClick={this.removeFromQueue}>
          <FontAwesomeIcon icon="forward" /> Skip {showPoints}
        </a>
      );
    }

    // If gamify enabled
    if (!this.state.contextMenuTrack.protected && protectPerkLevel > 0) {
      const protectCost = this.calculateProtectCost(this.state.contextMenuTrack.track);
      menu.push(
        <a className={"dropdown-item"} key={"protectTrack"} href="#" onClick={this.protectTrack}>
          <FontAwesomeIcon icon="shield-alt" /> Protect from skip (-{protectCost} pts)
        </a>
      );
    }

    if (menu.length === 0) {
      this.hideMenu();
    }

    return menu;
  }
  protected showContextMenu(targetId: string, isPlaying: boolean, index: number) {
    const track: IQueuedItem = (!isPlaying)
      ? this.props.queue!.find(q => q.id === targetId)!
      : this.props.currentTrack!;
    this.setState(() => ({
      contextMenuId: targetId,
      contextMenuTrack: track,
      contextMenuTargetPlaying: isPlaying,
      contextMenuIndex: index,
    }));
  }
  protected hideMenu() {
    this.setState(() => ({
      contextMenuId: null,
      contextMenuTrack: null,
      contextMenuTargetPlaying: false
    }));
  }

  protected renderTracks() {
    if (!this.props.queue) {
      return null;
    }

    const progress = this.props.currentTrack && this.props.currentTrack.track.progress ? this.props.currentTrack.track.progress : 0;
    let totalDuration = this.props.currentTrack ? this.props.currentTrack.track.duration - progress : 0;
    return this.props.queue.map((queuedItem, i) => {
      const element = <li className="queuedTrack" key={"queue-" + i}>
        <div className="dropup">
          <Track
            name={queuedItem.track.name}
            artist={queuedItem.track.artist}
            id={queuedItem.id}
            trackId={queuedItem.track.id}
            artistId={queuedItem.track.artistId}
            duration={queuedItem.track.duration}
            key={i + "-" + queuedItem.track.id}
            index={i}
            isPlaying={false}
            source={queuedItem.source}
            protectedTrack={queuedItem.protected}
            owned={queuedItem.userId === this.props.user!.id}
            isFavorite={queuedItem.track.isFavorite}
            selectTrack={this.showContextMenu}
            totalDuration={totalDuration}
            toggleFromFavorites={this.props.onToggleFromFavorites} />
        </div>
        <div className={"dropdown-menu " + (this.state.contextMenuId === queuedItem.id ? "show" : "hide")} aria-labelledby="deviceMenuButton">
          {this.renderContextMenu()}
        </div>
      </li>;
      totalDuration += queuedItem.track.duration;
      return element;
    });
  }

  public render() {
    return (
      <div className="queue">
        <ol className={"queuedTracks " + (this.props.settings && this.props.settings.randomQueue ? "randomQueue" : "")}>
          {this.renderCurrentTrack()}
          {this.renderTracks()}
        </ol>
        <div className={"menuOverlay " + (this.state.contextMenuId ? "visible" : "hidden")} onClick={this.hideMenu} />
      </div>
    );
  }

  private calculateProtectCost(track: ITrackProps) {
    const millisLeft = track.duration - (track.progress || 0);
    const minutesLeft = Math.floor(millisLeft / 60000);
    return (minutesLeft + 1) * 5;
  }
  private calculateSkipCost(track: ITrackProps, perkLevel: number) {
    const millisLeft = track.duration - (track.progress || 0);
    const minutesLeft = Math.floor(millisLeft / 60000);
    const perkDiscount = perkLevel > 1 ? perkLevel : 0;
    return (minutesLeft + 1) * (5 - perkDiscount);
  }

  private userPerkLevel(perkName: PerkName) {
    if (!this.props.settings || !this.props.settings.gamify || !this.props.perks) {
      return 0;
    }
    const perk = this.props.perks.find(perk => perk.name === perkName);
    return perk ? perk.karmaAllowedLevel : 0;
  }
}
