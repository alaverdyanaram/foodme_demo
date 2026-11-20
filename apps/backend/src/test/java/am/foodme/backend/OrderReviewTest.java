package am.foodme.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Order ratings (order-ratings.spec.md): customers rate their own delivered orders once,
 * with 1-5 whole stars and an optional comment; the chef's rating becomes the rounded average.
 * Each test creates its own customer and orders, so nothing depends on test order.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderReviewTest {

    /** Chef 1 (marta-k) for general cases; chef 4 is reserved for the average check (see data.sql). */
    private static final long CHEF = 1;
    private static final long CHEF_DISH = 1;
    private static final long AVERAGE_CHEF = 4;
    private static final long AVERAGE_CHEF_DISH = 5;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // ---- helpers ------------------------------------------------------------

    private String customerToken() throws Exception {
        String email = "review-test-" + UUID.randomUUID() + "@example.com";
        String response = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Ann",
                                "email", email,
                                "phoneNumber", "+37491234567",
                                "password", "secret123"
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    private String adminToken() throws Exception {
        String response = mockMvc.perform(post("/admin/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "username", "admin",
                                "password", "admin123"
                        ))))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("token").asText();
    }

    private String placeOrder(String customerToken, long chefId, long dishId) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "chefId", chefId,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CASH",
                "deliveryMethod", "TAKEAWAY",
                "createOrderDishes", List.of(Map.of("dishId", dishId, "quantity", 1))
        ));
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("number").asText();
    }

    private long orderId(String number) throws Exception {
        String response = mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private void adminSetStatus(String adminToken, long id, String newStatus) throws Exception {
        mockMvc.perform(patch("/admin/order/" + id + "/status")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", newStatus))))
                .andExpect(status().isOk());
    }

    /** Places an order and walks it NEW -> ACCEPTED -> DELIVERED through the admin API. */
    private String deliveredOrder(String customerToken, long chefId, long dishId) throws Exception {
        String number = placeOrder(customerToken, chefId, dishId);
        String admin = adminToken();
        long id = orderId(number);
        adminSetStatus(admin, id, "ACCEPTED");
        adminSetStatus(admin, id, "DELIVERED");
        return number;
    }

    private String deliveredOrder(String customerToken) throws Exception {
        return deliveredOrder(customerToken, CHEF, CHEF_DISH);
    }

    private ResultActions review(String token, String number, Object rating, String comment) throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("rating", rating);
        if (comment != null) {
            body.put("comment", comment);
        }
        return mockMvc.perform(post("/api/customer/orders/" + number + "/review")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(body)));
    }

    // ---- AC1: rate a delivered order, rating persists --------------------------

    @Test
    void reviewOrder_ownDeliveredOrder_savesRatingAndComment() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token);

        review(token, number, 4, "Tasty and on time")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(number))
                .andExpect(jsonPath("$.review.rating").value(4))
                .andExpect(jsonPath("$.review.comment").value("Tasty and on time"))
                .andExpect(jsonPath("$.review.createdAt", notNullValue()));

        // Persisted: My Orders and order tracking show it after a reload (R13, R19).
        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[0].number").value(number))
                .andExpect(jsonPath("$.list[0].review.rating").value(4));
        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review.rating").value(4))
                .andExpect(jsonPath("$.review.comment").value("Tasty and on time"));
    }

    @Test
    void reviewOrder_withoutComment_succeeds() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token);

        review(token, number, 5, null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.rating").value(5))
                .andExpect(jsonPath("$.review.comment", nullValue()));
    }

    @Test
    void customerOrders_unratedOrder_hasNoReview() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token);

        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$.list[0].number").value(number))
                .andExpect(jsonPath("$.list[0].review", nullValue()));
    }

    // ---- AC2: not delivered, twice, someone else's ----------------------------

    @Test
    void reviewOrder_newOrder_badRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token, CHEF, CHEF_DISH);

        review(token, number, 5, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only delivered orders can be reviewed."));
    }

    @Test
    void reviewOrder_acceptedOrder_badRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token, CHEF, CHEF_DISH);
        adminSetStatus(adminToken(), orderId(number), "ACCEPTED");

        review(token, number, 5, null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only delivered orders can be reviewed."));
    }

    @Test
    void reviewOrder_secondAttempt_badRequestAndFirstKept() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token);
        review(token, number, 2, "Cold").andExpect(status().isOk());

        review(token, number, 5, "Changed my mind")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Order already reviewed."));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review.rating").value(2))
                .andExpect(jsonPath("$.review.comment").value("Cold"));
    }

    @Test
    void reviewOrder_someoneElsesOrder_notFoundAndUnrated() throws Exception {
        String number = deliveredOrder(customerToken());

        review(customerToken(), number, 1, null)
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review", nullValue()));
    }

    @Test
    void reviewOrder_unknownNumber_notFound() throws Exception {
        review(customerToken(), "FM-DOES-NOT-EXIST", 5, null)
                .andExpect(status().isNotFound());
    }

    // ---- AC3: invalid stars / comment ------------------------------------------

    @Test
    void reviewOrder_invalidRating_badRequestAndUnrated() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token);

        for (Object rating : new Object[]{0, 6, -1, 4.5}) {
            review(token, number, rating, null)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Rating must be a whole number of stars from 1 to 5"));
        }
        review(token, number, null, "No stars")
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review", nullValue()));
    }

    @Test
    void reviewOrder_commentOver1000Chars_badRequest() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token);

        review(token, number, 3, "x".repeat(1001))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Comment must be at most 1000 characters"));
    }

    @Test
    void reviewOrder_commentOfExactly1000Chars_succeeds() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token);

        review(token, number, 3, "x".repeat(1000))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.rating").value(3));
    }

    // ---- AC4: signed-in customers only -----------------------------------------

    @Test
    void reviewOrder_withoutToken_unauthorized() throws Exception {
        String number = deliveredOrder(customerToken());

        mockMvc.perform(post("/api/customer/orders/" + number + "/review")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"rating\":5}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.review", nullValue()));
    }

    // ---- AC5: chef rating is the rounded average --------------------------------

    @Test
    void reviewOrder_updatesChefRatingToRoundedAverage() throws Exception {
        // Chef 4 is only used here, so its reviews are exactly the ones below.
        String token = customerToken();
        String first = deliveredOrder(token, AVERAGE_CHEF, AVERAGE_CHEF_DISH);
        String second = deliveredOrder(token, AVERAGE_CHEF, AVERAGE_CHEF_DISH);
        String third = deliveredOrder(token, AVERAGE_CHEF, AVERAGE_CHEF_DISH);

        review(token, first, 5, null).andExpect(status().isOk());
        mockMvc.perform(get("/api/chef/" + AVERAGE_CHEF))
                .andExpect(jsonPath("$.rating").value(5.0));

        review(token, second, 4, null).andExpect(status().isOk());
        review(token, third, 4, null).andExpect(status().isOk());

        // (5 + 4 + 4) / 3 = 4.333... -> 4.3
        mockMvc.perform(get("/api/chef/" + AVERAGE_CHEF))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rating").value(4.3));
    }

    // ---- AC6: admin sees stars, comment and date --------------------------------

    @Test
    void adminOrder_ratedOrder_showsReview() throws Exception {
        String token = customerToken();
        String number = deliveredOrder(token);
        review(token, number, 1, "Arrived late").andExpect(status().isOk());

        mockMvc.perform(get("/admin/order/" + orderId(number)).header("Authorization", "Bearer " + adminToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.rating").value(1))
                .andExpect(jsonPath("$.review.comment").value("Arrived late"))
                .andExpect(jsonPath("$.review.createdAt", notNullValue()));
    }
}
