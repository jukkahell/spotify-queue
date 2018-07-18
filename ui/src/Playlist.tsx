import * as React from "react";
import { FontAwesomeIcon } from "../node_modules/@fortawesome/react-fontawesome";

export interface IPlaylistProps {
    name: string;
    id: string;
    activeId: string;
}

export class Album extends React.Component<IPlaylistProps> {

    public constructor(props: IPlaylistProps) {
        super(props);
    }

    public render() {
        const {
            name,
            id,
            activeId
        } = this.props;

        return (
            <div>
                <a className={"playlistItem " + (activeId === id ? "active" : "")} href={"#playlist=" + id} id={id}>
                    {name}
                    {activeId === id ? <div className="speakerIcon"><FontAwesomeIcon icon="volume-up" /></div> : null}
                </a>
            </div>
        );
    }
}

export default Album;
