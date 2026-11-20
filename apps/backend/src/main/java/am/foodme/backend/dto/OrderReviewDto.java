package am.foodme.backend.dto;

import am.foodme.backend.model.OrderReview;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/** The rating shown with an order (R13): stars, comment and when it was given. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderReviewDto {
    private Integer rating;
    private String comment;
    private LocalDateTime createdAt;

    public static OrderReviewDto mapEntityToDto(OrderReview entity) {
        if (entity == null) {
            return null;
        }
        return new OrderReviewDto(entity.getRating(), entity.getComment(), entity.getCreatedAt());
    }
}
