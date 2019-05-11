import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import { IUser } from "./App";
import config from "./config";
import { ISettings } from "./Settings";

export interface IPerk {
  name: PerkName;
  price: number;
  requiredKarma: number;
  upgradeKarma?: number;
  level: number;
  karmaAllowedLevel: number;
  maxLevel: number;
}

export interface IPerkStoreProps {
  onError: (msg: string) => void;
  onBuyOrUpgrade: () => void;
  perks: IPerk[];
  user: IUser;
  settings: ISettings | null;
}

export interface IPerkStoreState {
  dropdownVisible: boolean;
  selectedPerk: string | null;
}

export type PerkName = "move_up" | "queue_more_1" | "queue_sequential_1" | "protect_song" | "remove_song" | "skip_song" | "move_first";

export class PerkStore extends React.Component<IPerkStoreProps, IPerkStoreState> {

  public constructor(props: IPerkStoreProps) {
    super(props);
    this.state = {
      dropdownVisible: false,
      selectedPerk: null
    };

    this.dropdownClicked = this.dropdownClicked.bind(this);
    this.hideMenu = this.hideMenu.bind(this);
    this.selectPerk = this.selectPerk.bind(this);
    this.buyPerk = this.buyPerk.bind(this);
    this.upgradePerk = this.upgradePerk.bind(this);
  }

  public dropdownClicked(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();
    this.setState((prevState) => ({
      dropdownVisible: !prevState.dropdownVisible
    }));
  }

  public hideMenu() {
    this.setState(() => ({
      selectedPerk: null,
      dropdownVisible: false
    }));
  }

  public selectPerk(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    if (this.props.perks) {
      if (this.state.selectedPerk !== e.currentTarget.id) {
        this.setState({
          selectedPerk: e.currentTarget.id
        });
      } else {
        this.setState({
          selectedPerk: null
        });
      }
    }
  }

  public buyPerk(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    if (window.confirm("Are you sure you want to buy this perk?")) {
      axios.post(config.backend.url + "/buyPerk", {
        perk: e.currentTarget.id.split("buy-")[1]
      }).then(() => {
        this.props.onBuyOrUpgrade();
      }).catch(error => {
        this.props.onError(error.response.data.message);
      });
    }

    this.setState({
      selectedPerk: null
    });
  }

  public upgradePerk(e: React.MouseEvent<HTMLElement>) {
    e.preventDefault();

    if (window.confirm("Are you sure you want to upgrade this perk?")) {
      axios.put(config.backend.url + "/upgradePerk", {
        perk: e.currentTarget.id.split("upgrade-")[1]
      }).then(() => {
        this.props.onBuyOrUpgrade();
      }).catch(error => {
        this.props.onError(error.response.data.message);
      });
    }

    this.setState({
      selectedPerk: null
    });
  }

  public renderAvailablePerks() {
    if (!this.props.perks) {
      return null;
    }
    return this.props.perks
      .filter((perk: IPerk) => perk.level === 0)
      .map((perk: IPerk, i: number) => (
        <div className={"dropdown-item"} key={"user-" + i}>
          <div id={perk.name}
            className={"perksListItem "
              + (this.props.user.karma >= perk.requiredKarma ? "availablePerk" : "unavailablePerk")}
              onClick={this.selectPerk}>
            <span className="userId" title={perk.requiredKarma > this.props.user.karma ? "Requires " + perk.requiredKarma + " karma" : ""}>{this.getDetails(perk.name, 1).name}</span>
            <span className="perkPrice">{perk.price} pts</span>
          </div>
          <div className={"perkDetails " + (this.state.selectedPerk === perk.name ? "visible" : "d-none")}>
            <span className="perkDescription">
              {this.getDetails(perk.name, 1).description}<br />
              Required karma: {perk.requiredKarma}
              {this.props.user.points >= perk.price && perk.requiredKarma > this.props.user.karma
                ? <FontAwesomeIcon
                    className="exclamation"
                    title={"You can buy this perk but " + (perk.requiredKarma - this.props.user.karma) + " more karma is needed to use it."}
                    icon="exclamation-triangle" />
                : null}
            </span>
            <button disabled={this.props.user.points < perk.price} title={this.props.user.points >= perk.price ? "Buy perk" : "Not enough points to buy"} type="submit"
              className={"btn btn-primary"}
              id={"buy-" + perk.name} onClick={this.buyPerk}>
                Buy <FontAwesomeIcon icon="coins" />
            </button>
          </div>
        </div>
    ));
  }

  public renderOwnedPerks() {
    if (!this.props.perks) {
      return null;
    }
    return this.props.perks
      .filter((perk: IPerk) => perk.level > 0)
      .map((perk: IPerk, i: number) => (
        <div className={"dropdown-item"} key={"user-" + i}>
          <div id={perk.name}
            className={"perksListItem "
              + (this.props.user.karma >= perk.requiredKarma ? "availablePerk" : "unavailablePerk")}
              onClick={this.selectPerk}>
            <span className="userId" title={perk.requiredKarma > this.props.user.karma ? "Requires " + perk.requiredKarma + " karma" : ""}>
              {perk.requiredKarma > this.props.user.karma
                ? <FontAwesomeIcon
                    className="exclamation"
                    title={(perk.requiredKarma - this.props.user.karma) + " more karma is needed to use this."}
                    icon="exclamation-triangle" />
                : null}
              {this.getDetails(perk.name, perk.level).name}
            </span>
            <span className="perkPrice" title={"Bought level is " + perk.level}>{perk.karmaAllowedLevel} lvl</span>
          </div>
          <div className={"perkDetails " + (this.state.selectedPerk === perk.name ? "visible" : "d-none")}>
            <span className="perkDescription">
              {this.getDetails(perk.name, Math.min(perk.maxLevel, perk.level + 1)).description}<br />
              <span className={perk.maxLevel > perk.level ? "visible" : "d-none"}>
                Required karma for upgraded level: {perk.upgradeKarma}
                {this.props.user.points >= perk.price && perk.upgradeKarma! > this.props.user.karma
                  ? <FontAwesomeIcon
                      className="exclamation"
                      title={"You can upgrade this perk but " + (perk.upgradeKarma! - this.props.user.karma) + " more karma is needed to make it effective."}
                      icon="exclamation-triangle" />
                  : null}
                <br />
                Upgrade price: {perk.price} pts
              </span>
            </span>
            {perk.maxLevel > perk.level
              ? <button disabled={this.props.user.points < perk.price} title={this.props.user.points >= perk.price ? "Upgrade perk" : "Not enough points to upgrade"} type="submit"
                  className={"btn btn-primary"}
                  id={"upgrade-" + perk.name} onClick={this.upgradePerk}>
                    Upgrade to level {perk.level + 1} <FontAwesomeIcon icon="level-up-alt" />
                </button>
              : "Max level reached"}
          </div>
        </div>
    ));
  }

  public render() {
    return (
      <div className="perks">
        <div className="availablePerks">
          <h5>Available perks</h5>
          {this.renderAvailablePerks()}
        </div>
        <div className="ownedPerks">
          <h5>Owned perks</h5>
          {this.renderOwnedPerks()}
        </div>
      </div>
    );
  }

  private getDetails(name: PerkName, level: number) {
    const total = this.props.settings ? " Total of " + (this.props.settings.numberOfTracksPerUser + level) + " songs." : "";
    const totalSequential = this.props.settings ? " Total of " + (this.props.settings.maxSequentialTracks + level) + " sequential songs." : "";
    const names = {
      move_up: {name: "Move songs up in queue", description: "You gain ability to move one song " + level + (level > 1 ? " steps" : " step") + " up in the queue."},
      queue_more_1: {name: "Queue more songs", description: "You can queue +" + level + (level > 1 ? " songs" : " song") + "." + total},
      queue_sequential_1: {name: "Queue more sequential songs", description: "You can queue +" + level + " more sequential songs than before." + totalSequential},
      protect_song: {name: "Protect song", description: "Gain ability to protect any song in the queue from being removed or skipped by other users."},
      remove_song: {name: "Remove from queue", description: "You gain ability to remove songs added by other users from the queue. " + (level > 1 ? "Get " + (level * 10) + "% cheaper cost." : "")},
      skip_song: {name: "Skip current song", description: "You gain ability to skip currently playing song added by other users. " + (level > 1 ? "Get " + (level * 10) + "% cheaper cost." : "")},
      move_first: {name: "Move song first in queue", description: "You gain ability to move any song you want to be played next."},
    };

    return names[name];
  }
}

export default PerkStore;
