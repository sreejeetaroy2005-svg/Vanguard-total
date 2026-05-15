package vanguard.gdc.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;
import java.util.HashMap;
import java.util.Map;

@RestController
@CrossOrigin(origins = "*")
public class RootController {

    @GetMapping("/")
    public Map<String, String> welcome() {
        Map<String, String> response = new HashMap<>();
        response.put("name", "Vanguard Tactical Backend");
        response.put("status", "ONLINE");
        response.put("api_root", "/api/alerts");
        response.put("documentation", "Vanguard System GDC Node");
        return response;
    }
}
