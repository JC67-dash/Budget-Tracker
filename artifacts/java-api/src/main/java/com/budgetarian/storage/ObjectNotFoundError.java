package com.budgetarian.storage;

public class ObjectNotFoundError extends RuntimeException {
    public ObjectNotFoundError() {
        super("Object not found");
    }
    public ObjectNotFoundError(String message) {
        super(message);
    }
}
