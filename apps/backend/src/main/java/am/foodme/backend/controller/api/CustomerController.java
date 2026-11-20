package am.foodme.backend.controller.api;

import am.foodme.backend.dto.CustomerProfileDto;
import am.foodme.backend.dto.OrderDto;
import am.foodme.backend.dto.OrderListResponseDto;
import am.foodme.backend.dto.OrderReviewRequestDto;
import org.springframework.web.bind.annotation.RequestBody;
import am.foodme.backend.service.CustomerAuthService;
import am.foodme.backend.service.OrderService;
import am.foodme.backend.utils.ControllerUtil;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ControllerUtil.API_CUSTOMER_CONTROLLER)
public class CustomerController {

    private final CustomerAuthService customerAuthService;
    private final OrderService orderService;

    public CustomerController(CustomerAuthService customerAuthService, OrderService orderService) {
        this.customerAuthService = customerAuthService;
        this.orderService = orderService;
    }

    @GetMapping("/me")
    public CustomerProfileDto me(Authentication authentication) {
        return customerAuthService.me(authentication.getName());
    }

    @GetMapping("/orders")
    public OrderListResponseDto orders(Authentication authentication,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "20") int size) {
        return orderService.listForCustomer(authentication.getName(), page, size);
    }

    /** KAN-5: cancel one of the signed-in customer's orders before the kitchen accepts it. */
    @PostMapping("/orders/{number}/cancel")
    public OrderDto cancelOrder(Authentication authentication, @PathVariable String number) {
        return orderService.cancelForCustomer(number, authentication.getName());
    }

    /** Order ratings: rate one of the signed-in customer's delivered orders (1-5 stars + optional comment). */
    @PostMapping("/orders/{number}/review")
    public OrderDto reviewOrder(Authentication authentication, @PathVariable String number,
                                @RequestBody OrderReviewRequestDto request) {
        return orderService.reviewForCustomer(number, authentication.getName(), request);
    }
}
