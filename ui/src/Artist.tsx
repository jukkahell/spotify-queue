import * as React from "react";

export interface IArtistProps {
    name: string;
    id: string;
    onArtistSelected: (id: string) => void;
}

export class Artist extends React.Component<IArtistProps> {

    public constructor(props: IArtistProps) {
        super(props);
        this.selectArtist = this.selectArtist.bind(this);
    }

    protected selectArtist(event: React.MouseEvent<HTMLElement>) {
        this.props.onArtistSelected(event.currentTarget.id);
    }

    public render() {
        const {
            name,
            id
        } = this.props;

        return (
            <div>
                <a onClick={this.selectArtist} href={"#artist:" + id} id={id}>{name}</a>
            </div>
        );
    }
}

export default Artist;
