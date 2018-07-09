import * as React from "react";

export interface IArtistProps {
    name: string;
    id: string;
}

export class Artist extends React.Component<IArtistProps> {

    public constructor(props: IArtistProps) {
        super(props);
    }

    public render() {
        const {
            name,
            id
        } = this.props;

        return (
            <div>
                <a href={"#artist:" + id} id={id}>{name}</a>
            </div>
        );
    }
}

export default Artist;
