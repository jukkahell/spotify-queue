import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as React from "react";

export class Album extends React.Component {

    constructor(props) {
        super(props);

        this.addToQueue = this.addToQueue.bind(this);
    }

    addToQueue(e) {
        e.preventDefault();
        this.props.addToQueue(e.currentTarget.id);
    }

    render() {
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
                    {settings && settings.playlist === id ? <div className="speakerIcon"><FontAwesomeIcon icon="volume-up" /></div> : null}
                </a>
            </div>
        );
    }
}

export default Album;
