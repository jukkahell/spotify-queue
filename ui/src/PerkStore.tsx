import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import axios from "axios";
import * as React from "react";
import { IUser } from "./App";
import config from "./config";

export interface IPerk {
  name: string;
  price: number;
  requiredKarma: number;
  level: number;
}

export interface IPerkStoreProps {
  onError: (msg: string) => void;
  onBuyOrUpgrade: () => void;
  perks: IPerk[];
  user: IUser;
}

export interface IPerkStoreState {
  dropdownVisible: boolean;
  selectedPerk: string | null;
}

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
      this.setState({
        selectedPerk: e.currentTarget.id
      });
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
        userId: e.currentTarget.id.split("upgrade-")[1]
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

  public renderPerks() {
    if (!this.props.perks) {
      return null;
    }
    return this.props.perks.map((perk: IPerk, i: number) => (
      <div className={"dropdown-item"} key={"user-" + i}>
        <div id={perk.name}
          className={"perksListItem "
            + (this.state.selectedPerk === perk.name ? "d-none " : "visible ")
            + (this.props.user.karma >= perk.requiredKarma ? "availablePerk" : "unavailablePerk")}
            onClick={this.selectPerk}>
          <span className="ownedPerk" title={perk.level > 0 ? "Owned perk" : "Unowned perk"}><FontAwesomeIcon icon={[perk.level > 0 ? "fas" : "far", "star"]} /></span>
          <span className="userId" title={perk.requiredKarma > this.props.user.karma ? "Requires " + perk.requiredKarma + " karma" : ""}>{this.getName(perk.name)}</span>
          <span className="perkPrice">{perk.price} pts</span>
        </div>
        <div className={"userListContextMenu " + (this.state.selectedPerk === perk.name ? "visible" : "d-none")}>
          {perk.level === 0
            ? <a href="#" id={"buy-" + perk.name} title="Buy perk" onClick={this.buyPerk}>
                Buy perk <FontAwesomeIcon icon="coins" />
              </a>
            : <a href="#" id={"upgrade-" + perk.name} title={"Upgrade to level " + (perk.level + 1)} onClick={this.upgradePerk}>
                Upgrade to level {perk.level + 1} <FontAwesomeIcon icon="level-up-alt" />
              </a>
          }
        </div>
      </div>
    ));
  }

  public render() {
    return (
      this.renderPerks()
    );
  }

  private getName(name: string) {
    const names = {
      move_up: "Move songs up in queue",
      queue_more_1: "Queue +1 song",
      queue_sequential_1: "Queue +1 sequential songs",
      remove_song: "Remove from queue",
      skip_song: "Skip current song",
      queue_more_2: "Queue +2 songs",
      queue_sequential_2: "Queue +2 sequential songs",
      move_first: "Move song first in queue",
    };

    return names[name];
  }
}

export default PerkStore;
