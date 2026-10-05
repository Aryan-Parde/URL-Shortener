BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
MAX_BIGINT = 2**63 - 1


def encode_base62(value: int) -> str:
    # Validate the input value (as bool is a subclass of int, we need to check for bool first & then check for int as it may be double or float)
    if isinstance(value, bool) or not isinstance(value, int):
        raise TypeError("value must be an integer")
    #Now as we know that the value is an integer, we can check if it is within the valid range
    if value <= 0 or value > MAX_BIGINT:
        raise ValueError("value must be between 1 and 2^63 - 1")

    #Convert the integer to base62
    characters: list[str] = []
    while value:
        value, remainder = divmod(value, 62)
        characters.append(BASE62_ALPHABET[remainder])

    return "".join(reversed(characters))


def decode_base62(code: str) -> int:
    if not code:
        raise ValueError("code must not be empty")

    value = 0
    for character in code:
        try:
            digit = BASE62_ALPHABET.index(character)
        except ValueError as error:
            raise ValueError("code contains an invalid Base62 character") from error
        value = value * 62 + digit
        if value > MAX_BIGINT:
            raise ValueError("decoded value exceeds the BIGINT range")

    if value <= 0:
        raise ValueError("decoded value must be positive")
    return value
