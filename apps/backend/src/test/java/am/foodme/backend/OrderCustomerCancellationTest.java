package am.foodme.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * KAN-5: customers cancel their own order before the kitchen accepts it.
 * Each test creates its own customer and order, so nothing depends on test order.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderCustomerCancellationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    // ---- helpers ------------------------------------------------------------

    private String customerToken() throws Exception {
        String email = "cancel-test-" + UUID.randomUUID() + "@example.com";
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

    /** Places a cash takeaway order for the customer and returns its number. */
    private String placeOrder(String customerToken) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of(
                "chefId", 1,
                "receiverName", "Ann",
                "receiverPhoneNumber", "+37491234567",
                "receiverEmail", "ann@example.com",
                "paymentType", "CASH",
                "deliveryMethod", "TAKEAWAY",
                "createOrderDishes", List.of(Map.of("dishId", 1, "quantity", 1))
        ));
        String response = mockMvc.perform(post("/api/order")
                        .header("Authorization", "Bearer " + customerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NEW"))
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
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(newStatus));
    }

    private ResultActions cancel(String token, String number) throws Exception {
        return mockMvc.perform(post("/api/customer/orders/" + number + "/cancel")
                .header("Authorization", "Bearer " + token));
    }

    // ---- AC1: cancel only while "Received" (NEW) ------------------------------

    @Test
    void cancelOrder_ownNewOrder_becomesCancelled() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);

        cancel(token, number)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(number))
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        // The cancellation is persisted, not just echoed back.
        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void cancelOrder_withoutToken_unauthorized() throws Exception {
        String number = placeOrder(customerToken());

        mockMvc.perform(post("/api/customer/orders/" + number + "/cancel"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("NEW"));
    }

    @Test
    void cancelOrder_someoneElsesOrder_notFoundAndUnchanged() throws Exception {
        String number = placeOrder(customerToken());
        String otherCustomer = customerToken();

        cancel(otherCustomer, number)
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("NEW"));
    }

    @Test
    void cancelOrder_unknownNumber_notFound() throws Exception {
        cancel(customerToken(), "FM-DOES-NOT-EXIST")
                .andExpect(status().isNotFound());
    }

    // ---- AC2: refused once the kitchen accepts --------------------------------

    @Test
    void cancelOrder_acceptedOrder_badRequestAndStaysAccepted() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        adminSetStatus(adminToken(), orderId(number), "ACCEPTED");

        cancel(token, number)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only orders the kitchen hasn't accepted yet can be cancelled"));

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("ACCEPTED"));
    }

    @Test
    void cancelOrder_rejectedOrder_badRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        adminSetStatus(adminToken(), orderId(number), "REJECTED");

        cancel(token, number)
                .andExpect(status().isBadRequest());
    }

    @Test
    void cancelOrder_alreadyCancelled_badRequest() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        cancel(token, number).andExpect(status().isOk());

        cancel(token, number)
                .andExpect(status().isBadRequest());
    }

    // ---- AC3: shown as Cancelled in My Orders and the admin panel -------------

    @Test
    void customerOrders_afterCancel_listsOrderAsCancelled() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        cancel(token, number).andExpect(status().isOk());

        mockMvc.perform(get("/api/customer/orders").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.list[0].number").value(number))
                .andExpect(jsonPath("$.list[0].status").value("CANCELLED"));
    }

    @Test
    void adminOrders_afterCancel_showsCancelledStatusAndFilters() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        long id = orderId(number);
        cancel(token, number).andExpect(status().isOk());
        String admin = adminToken();

        mockMvc.perform(get("/admin/order/" + id).header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));

        String filtered = mockMvc.perform(get("/admin/order")
                        .param("status", "CANCELLED")
                        .param("size", "100")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode list = objectMapper.readTree(filtered).get("list");
        boolean found = false;
        for (JsonNode order : list) {
            assertEquals("CANCELLED", order.get("status").asText());
            found |= number.equals(order.get("number").asText());
        }
        assertTrue(found, "cancelled order missing from the CANCELLED filter");
    }

    // ---- AC4: cancelled is final ---------------------------------------------

    @Test
    void adminUpdateStatus_cancelledOrder_everyTransitionRefused() throws Exception {
        String token = customerToken();
        String number = placeOrder(token);
        long id = orderId(number);
        cancel(token, number).andExpect(status().isOk());
        String admin = adminToken();

        for (String target : List.of("NEW", "ACCEPTED", "DELIVERED", "REJECTED")) {
            mockMvc.perform(patch("/admin/order/" + id + "/status")
                            .header("Authorization", "Bearer " + admin)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(Map.of("status", target))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.message").value("Cannot transition order from CANCELLED to " + target));
        }

        mockMvc.perform(get("/api/order/number/" + number))
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void adminUpdateStatus_toCancelled_refused() throws Exception {
        // Only the customer cancels; the back office rejects instead.
        String number = placeOrder(customerToken());

        mockMvc.perform(patch("/admin/order/" + orderId(number) + "/status")
                        .header("Authorization", "Bearer " + adminToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "CANCELLED"))))
                .andExpect(status().isBadRequest());
    }
}
