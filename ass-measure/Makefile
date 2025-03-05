CC = gcc
CFLAGS = -Wall -Wextra -O2 -fPIC $(shell pkg-config --cflags libass)
LDFLAGS = $(shell pkg-config --libs libass)

SRC_DIR = src
INCLUDE_DIR = include
EXAMPLES_DIR = examples
BIN_DIR = bin
LIB_DIR = lib

LIB_SRC = $(SRC_DIR)/ass_measure.c
LIB_OBJ = $(BIN_DIR)/ass_measure.o
LIB_NAME = libass_measure.a
LIB_TARGET = $(LIB_DIR)/$(LIB_NAME)

EXAMPLE_NAME = measure_example
EXAMPLE_SRC = $(EXAMPLES_DIR)/measure_example.c
EXAMPLE_BIN = $(BIN_DIR)/$(EXAMPLE_NAME)

.PHONY: all clean dirs lib example install uninstall

all: dirs lib example

dirs:
	mkdir -p $(BIN_DIR) $(LIB_DIR)

# Explicit rule for building the static library (this is what you missed!)
$(LIB_TARGET): $(LIB_OBJ)
	ar rcs $(LIB_TARGET) $(LIB_OBJ)

$(LIB_OBJ): $(LIB_SRC) $(INCLUDE_DIR)/ass_measure.h
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) -c $(LIB_SRC) -o $(LIB_OBJ)

lib: $(LIB_TARGET)

example: $(EXAMPLE_BIN)

$(EXAMPLE_BIN): $(EXAMPLE_SRC) $(LIB_TARGET)
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) $(EXAMPLE_SRC) $(LIB_TARGET) $(LDFLAGS) -o $(EXAMPLE_BIN)

clean:
	rm -rf $(BIN_DIR) $(LIB_DIR)

install: lib
	install -m 644 $(INCLUDE_DIR)/ass_measure.h /usr/local/include/
	install -m 644 $(LIB_TARGET) /usr/local/lib/

uninstall:
	rm -f /usr/local/include/ass_measure.h
	rm -f /usr/local/lib/$(LIB_NAME)

