CC = gcc
CFLAGS = -Wall -Wextra -std=c11 -I./include
# Use pkg-config to get the correct flags for libass
LIBASS_CFLAGS = $(shell pkg-config --cflags libass)
LIBASS_LDFLAGS = $(shell pkg-config --libs libass)

# Add libass flags to our flags
CFLAGS += $(LIBASS_CFLAGS)
LDFLAGS = $(LIBASS_LDFLAGS)

# Directories
SRC_DIR = src
INCLUDE_DIR = include
EXAMPLES_DIR = examples
BIN_DIR = bin
LIB_DIR = lib

# Files
SRC_FILES = $(wildcard $(SRC_DIR)/*.c)
OBJ_FILES = $(patsubst $(SRC_DIR)/%.c,$(BIN_DIR)/%.o,$(SRC_FILES))
LIB_NAME = libass_measure.a
EXAMPLE_NAME = measure_example

# Targets
.PHONY: all clean dirs examples

all: dirs $(LIB_DIR)/$(LIB_NAME) examples

# Create necessary directories
dirs:
	@mkdir -p $(BIN_DIR) $(LIB_DIR)

# Compile library object files
$(BIN_DIR)/%.o: $(SRC_DIR)/%.c
	$(CC) $(CFLAGS) -c $< -o $@

# Create static library
$(LIB_DIR)/$(LIB_NAME): $(OBJ_FILES)
	ar rcs $@ $^

# Build examples
examples: $(LIB_DIR)/$(LIB_NAME)
	@mkdir -p $(BIN_DIR)/examples
	$(CC) $(CFLAGS) $(EXAMPLES_DIR)/$(EXAMPLE_NAME).c -o $(BIN_DIR)/$(EXAMPLE_NAME) -L$(LIB_DIR) -lass_measure $(LDFLAGS)

# Clean up
clean:
	rm -rf $(BIN_DIR) $(LIB_DIR)

# Install the library and headers (requires root privileges)
install: all
	install -d $(DESTDIR)/usr/local/include/ass_measure
	install -d $(DESTDIR)/usr/local/lib
	install -m 644 $(INCLUDE_DIR)/*.h $(DESTDIR)/usr/local/include/ass_measure
	install -m 644 $(LIB_DIR)/$(LIB_NAME) $(DESTDIR)/usr/local/lib
	@echo "Library installed to /usr/local"

# Uninstall the library and headers
uninstall:
	rm -rf $(DESTDIR)/usr/local/include/ass_measure
	rm -f $(DESTDIR)/usr/local/lib/$(LIB_NAME)
	@echo "Library uninstalled from /usr/local" 