CREATE TABLE clicks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    link_id BIGINT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    referrer TEXT,
    country TEXT
);

CREATE INDEX clicks_link_id_clicked_at_idx
    ON clicks (link_id, clicked_at);
