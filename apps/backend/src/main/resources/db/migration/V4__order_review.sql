-- Order ratings: a customer rates a delivered order with 1-5 stars and an optional comment.
-- One review per order (R4). Reviews are never deleted (R5), so there is no ON DELETE CASCADE.
CREATE SEQUENCE IF NOT EXISTS foodme.order_review_id_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE foodme.order_review (
    id BIGINT NOT NULL PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE REFERENCES foodme."order"(id),
    customer_id BIGINT NOT NULL REFERENCES foodme.customer(id),
    chef_id BIGINT NOT NULL REFERENCES foodme.chef(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment VARCHAR(1000),
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX order_review_chef_id_idx ON foodme.order_review(chef_id);
