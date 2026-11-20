package am.foodme.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Body of POST /api/customer/orders/{number}/review.
 * {@code rating} is a Double on purpose: Jackson would silently truncate 4.5 into an Integer,
 * but R2 requires whole stars, so the service refuses fractions explicitly.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderReviewRequestDto {
    private Double rating;
    private String comment;
}
