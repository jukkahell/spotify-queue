import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";
import { ISettings } from "./Settings";

export interface IPlaylistProps {
    name: string;
    id: string;
    settings: ISettings | null;
    isOwner: boolean;
    addToQueue: (id: string) => void;
}

export class Album extends React.Component<IPlaylistProps> {

    public constructor(props: IPlaylistProps) {
        super(props);

        this.addToQueue = this.addToQueue.bind(this);
    }

    protected addToQueue(e: React.MouseEvent<HTMLElement>) {
        e.preventDefault();
        this.props.addToQueue(e.currentTarget.id);
    }

    public render() {
        const {
            name,
            id,
            settings,
            isOwner
        } = this.props;

        const clipboardIcon = (settings && settings.playlist === id)
            ? <FontAwesomeIcon icon="clipboard-check" />
            : <FontAwesomeIcon icon="clipboard-list" />;

        return (
            <div className="d-flex">
                {
                    isOwner ?
                        <div className={"addPlaylistToQueue " + (settings && settings.playlist === id ? "active" : "")} id={id} title="Play this list after queue ends" onClick={this.addToQueue}>
                            {clipboardIcon}
                        </div> :
                        null
                }
                <a className={"playlistItem"} href={"#playlist=" + id} id={id}>
                    {name}
                    {settings && settings.playlist === id ? <div className="queuedItemIcon"><FontAwesomeIcon icon="volume-up" /></div> : null}
                </a>
            </div>
        );
    }
}

export default Album;
